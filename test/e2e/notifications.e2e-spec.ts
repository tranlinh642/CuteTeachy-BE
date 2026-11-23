import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';
import { PUSH_SENDER } from '../../src/application/push-subscription/ports/push-sender.port';
import { FakePushSender } from '../fakes/fake-push-sender';

describe('Notifications E2E (S6-BE-02)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let fakePushSender: FakePushSender;

  beforeAll(async () => {
    fakePushSender = new FakePushSender();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PUSH_SENDER)
      .useValue(fakePushSender)
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    fakePushSender.clear();
    await prisma.inAppNotification.deleteMany();
    await prisma.sentReminder.deleteMany();
    await prisma.pushSubscription.deleteMany();
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
      .send({ fullName: 'Cô Lan', displayName: 'Lan', gender: 'female' })
      .expect(200);

    return { token, accountId };
  }

  describe('GET /notifications, PATCH /notifications/:id/read, POST /notifications/read-all', () => {
    it('returns 401 when unauthenticated', async () => {
      await request(app.getHttpServer()).get('/notifications').expect(401);
      await request(app.getHttpServer()).patch('/notifications/some-id/read').expect(401);
      await request(app.getHttpServer()).post('/notifications/read-all').expect(401);
    });

    it('lists notifications, filters by unreadOnly/limit, marks single and all as read, and enforces 404 account isolation', async () => {
      const teacher1 = await createTeacher('teacher-notif-1@example.com');
      const teacher2 = await createTeacher('teacher-notif-2@example.com');

      // Seed 2 notifications for teacher1 and 1 for teacher2
      await prisma.inAppNotification.create({
        data: {
          id: '11111111-1111-4111-8111-111111111111',
          accountId: teacher1.accountId,
          type: 'task',
          targetId: 'task-1',
          title: 'Nhắc nhở công việc: Chấm bài',
          body: '08:00',
          url: '/tasks?date=2026-10-29',
          createdAt: new Date('2026-10-29T07:00:00.000Z'),
        },
      });
      await prisma.inAppNotification.create({
        data: {
          id: '22222222-2222-4222-8222-222222222222',
          accountId: teacher1.accountId,
          type: 'note',
          targetId: 'note-1',
          title: 'Nhắc nhở ghi chú: Nộp sổ điểm',
          body: '09:00',
          url: '/notes?noteId=note-1',
          createdAt: new Date('2026-10-29T08:00:00.000Z'),
        },
      });
      await prisma.inAppNotification.create({
        data: {
          id: '33333333-3333-4333-8333-333333333333',
          accountId: teacher2.accountId,
          type: 'system',
          title: 'Thông báo riêng của giáo viên 2',
          body: 'Nội dung',
          url: '/',
          createdAt: new Date('2026-10-29T08:30:00.000Z'),
        },
      });

      // 1. GET /notifications for teacher1
      const listRes = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .expect(200);

      expect(listRes.body.unreadCount).toBe(2);
      expect(listRes.body.items).toHaveLength(2);
      expect(listRes.body.items[0].id).toBe('22222222-2222-4222-8222-222222222222');
      expect(listRes.body.items[1].id).toBe('11111111-1111-4111-8111-111111111111');

      // 2. PATCH /notifications/:id/read for teacher1's first notification
      const readRes = await request(app.getHttpServer())
        .patch('/notifications/22222222-2222-4222-8222-222222222222/read')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .expect(200);

      expect(readRes.body.id).toBe('22222222-2222-4222-8222-222222222222');
      expect(readRes.body.readAt).toBeTruthy();

      // 3. GET /notifications?unreadOnly=true for teacher1
      const unreadOnlyRes = await request(app.getHttpServer())
        .get('/notifications?unreadOnly=true&limit=10')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .expect(200);

      expect(unreadOnlyRes.body.unreadCount).toBe(1);
      expect(unreadOnlyRes.body.items).toHaveLength(1);
      expect(unreadOnlyRes.body.items[0].id).toBe('11111111-1111-4111-8111-111111111111');

      // 4. Account isolation: teacher1 tries to mark teacher2's notification as read -> 404
      const forbiddenReadRes = await request(app.getHttpServer())
        .patch('/notifications/33333333-3333-4333-8333-333333333333/read')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .expect(404);

      expect(forbiddenReadRes.body.code).toBe('not_found');

      // 5. POST /notifications/read-all for teacher1
      const readAllRes = await request(app.getHttpServer())
        .post('/notifications/read-all')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .expect(200);

      expect(readAllRes.body).toEqual({ updatedCount: 1 });

      // Verify teacher1 now has unreadCount = 0 while teacher2 still has unreadCount = 1
      const afterReadAll1 = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .expect(200);
      expect(afterReadAll1.body.unreadCount).toBe(0);

      const afterReadAll2 = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${teacher2.token}`)
        .expect(200);
      expect(afterReadAll2.body.unreadCount).toBe(1);
    });
  });

  describe('POST /push/subscriptions/test', () => {
    it('creates a test InAppNotification and dispatches Web Push to registered devices', async () => {
      const teacher = await createTeacher('teacher-test-push@example.com');

      // 1. Call test without any push subscription -> still creates InAppNotification
      const noSubRes = await request(app.getHttpServer())
        .post('/push/subscriptions/test')
        .set('Authorization', `Bearer ${teacher.token}`)
        .expect(200);

      expect(noSubRes.body).toEqual({
        sent: 0,
        failed: 0,
        inAppCreated: true,
      });

      // 2. Register a push subscription and call test again
      await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${teacher.token}`)
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-device-1',
          keys: {
            p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
            auth: 'tBHItJI5svbpez7KI4CCXg',
          },
        })
        .expect(201);

      const withSubRes = await request(app.getHttpServer())
        .post('/push/subscriptions/test')
        .set('Authorization', `Bearer ${teacher.token}`)
        .expect(200);

      expect(withSubRes.body).toEqual({
        sent: 1,
        failed: 0,
        inAppCreated: true,
      });
      expect(fakePushSender.getSentMessages()).toHaveLength(1);

      // Verify 2 system notifications exist in GET /notifications
      const listRes = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${teacher.token}`)
        .expect(200);

      expect(listRes.body.unreadCount).toBe(2);
      expect(listRes.body.items[0].type).toBe('system');
    });
  });
});
