import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';
import { PUSH_SENDER } from '../../src/application/push-subscription/ports/push-sender.port';
import { CLOCK } from '../../src/application/shared/ports/clock.port';
import { FakePushSender } from '../fakes/fake-push-sender';
import { FixedClock } from '../fakes/fixed-clock';

describe('POST /internal/reminders/dispatch (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let fakePushSender: FakePushSender;
  let clock: FixedClock;

  const validCronSecret = 'dev-cron-secret-token';
  // 2026-10-27 10:00 local in Asia/Ho_Chi_Minh (UTC+7) -> 03:00 UTC.
  // With 15 min lead, remindAt is 02:45 UTC.
  const fixedNow = new Date('2026-10-27T02:45:00.000Z');

  beforeAll(async () => {
    fakePushSender = new FakePushSender();
    clock = new FixedClock(fixedNow);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PUSH_SENDER)
      .useValue(fakePushSender)
      .overrideProvider(CLOCK)
      .useValue(clock)
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    fakePushSender.clear();
    clock.set(fixedNow);

    await prisma.sentReminder.deleteMany();
    await prisma.pushSubscription.deleteMany();
    await prisma.taskTag.deleteMany();
    await prisma.task.deleteMany();
    await prisma.settings.deleteMany();
    await prisma.rateLimitCounter.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.loginProvider.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.account.deleteMany();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function createTeacher(email: string): Promise<{ token: string; accountId: string }> {
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'Password123!' })
      .expect(201);

    const token = registerRes.body.accessToken;
    const accountId = registerRes.body.user.id;

    await request(app.getHttpServer())
      .patch('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Thầy Linh', displayName: 'Linh', gender: 'male' })
      .expect(200);

    return { token, accountId };
  }

  describe('Authentication & Authorization', () => {
    it('returns 401 when X-Cron-Secret header is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/internal/reminders/dispatch')
        .expect(401);

      expect(response.body.message).toContain('Missing X-Cron-Secret header');
    });

    it('returns 401 when X-Cron-Secret header is invalid', async () => {
      const response = await request(app.getHttpServer())
        .post('/internal/reminders/dispatch')
        .set('X-Cron-Secret', 'invalid-secret')
        .expect(401);

      expect(response.body.message).toContain('Invalid X-Cron-Secret header');
    });

    it('bypasses JWT and returns 200 with valid X-Cron-Secret header without Authorization', async () => {
      const response = await request(app.getHttpServer())
        .post('/internal/reminders/dispatch')
        .set('X-Cron-Secret', validCronSecret)
        .expect(200);

      expect(response.body).toEqual({
        sent: 0,
        skipped: 0,
      });
    });
  });

  describe('Dispatch Flow', () => {
    it('dispatches reminder for due task, saves SentReminder, and is idempotent on repeat', async () => {
      const { token, accountId } = await createTeacher('teacher@example.com');

      // 1. Register push subscription
      await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-device',
          keys: {
            p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
            auth: 'tBHItJI5svbpez7KI4CCXg',
          },
        })
        .expect(201);

      // 2. Create task with date: '2026-10-27', time: '10:00'
      // Settings default: Asia/Ho_Chi_Minh (+7), reminderLeadMinutes: 15
      // Task 10:00 - 15m = 09:45 local = 02:45 UTC = fixedNow!
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Soạn giáo án E2E',
          date: '2026-10-27',
          time: '10:00',
          category: 'school',
        })
        .expect(201);

      // 3. First dispatch call -> should send 1 reminder
      const firstDispatch = await request(app.getHttpServer())
        .post('/internal/reminders/dispatch')
        .set('X-Cron-Secret', validCronSecret)
        .expect(200);

      expect(firstDispatch.body).toEqual({
        sent: 1,
        skipped: 0,
      });

      // Verify fake push sender received message
      expect(fakePushSender.getSentMessages()).toHaveLength(1);
      const sentMsg = fakePushSender.getSentMessages()[0];
      expect(sentMsg.payload.title).toBe('Nhắc nhở công việc: Soạn giáo án E2E');
      expect(sentMsg.payload.body).toBe('10:00');
      expect(sentMsg.payload.url).toBe('/tasks?date=2026-10-27');

      // Verify DB record in sent_reminders
      const sentRecords = await prisma.sentReminder.findMany({
        where: { accountId },
      });
      expect(sentRecords).toHaveLength(1);
      expect(sentRecords[0].type).toBe('task');
      expect(sentRecords[0].targetId).toBe('11111111-1111-4111-8111-111111111111');
      expect(sentRecords[0].remindAt).toEqual(fixedNow);

      // 4. Second dispatch call immediately after -> should skip already sent reminder
      const secondDispatch = await request(app.getHttpServer())
        .post('/internal/reminders/dispatch')
        .set('X-Cron-Secret', validCronSecret)
        .expect(200);

      expect(secondDispatch.body).toEqual({
        sent: 0,
        skipped: 1,
      });

      // fakePushSender still has only 1 message
      expect(fakePushSender.getSentMessages()).toHaveLength(1);
    });

    it('does not send reminder when task is completed or deleted', async () => {
      const { token } = await createTeacher('teacher2@example.com');

      await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/device-2',
          keys: {
            p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
            auth: 'tBHItJI5svbpez7KI4CCXg',
          },
        })
        .expect(201);

      // Completed task
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: '22222222-2222-4222-8222-222222222222',
          title: 'Việc đã xong',
          date: '2026-10-27',
          time: '10:00',
          category: 'school',
          completed: true,
        })
        .expect(201);

      // Task without time
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: '33333333-3333-4333-8333-333333333333',
          title: 'Việc không có giờ',
          date: '2026-10-27',
          category: 'personal',
        })
        .expect(201);

      const dispatchRes = await request(app.getHttpServer())
        .post('/internal/reminders/dispatch')
        .set('X-Cron-Secret', validCronSecret)
        .expect(200);

      expect(dispatchRes.body.sent).toBe(0);
      expect(fakePushSender.getSentMessages()).toHaveLength(0);
    });
  });
});
