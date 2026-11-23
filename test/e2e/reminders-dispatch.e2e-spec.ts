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

    await prisma.inAppNotification.deleteMany();
    await prisma.sentReminder.deleteMany();
    await prisma.pushSubscription.deleteMany();
    await prisma.noteTag.deleteMany();
    await prisma.note.deleteMany();
    await prisma.taskTag.deleteMany();
    await prisma.task.deleteMany();
    await prisma.classSession.deleteMany();
    await prisma.timetableSlot.deleteMany();
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

  describe('Dispatch Flow - Task Reminders', () => {
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

  describe('Dispatch Flow - Class Session Reminders (S5-BE-03)', () => {
    it('dispatches reminder for due class session from timetable slot, saves SentReminder, and is idempotent on repeat', async () => {
      const { token, accountId } = await createTeacher('teacher-session@example.com');

      // 1. Register push subscription
      await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/session-device',
          keys: {
            p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
            auth: 'tBHItJI5svbpez7KI4CCXg',
          },
        })
        .expect(201);

      // 2. Create timetable slot on Tuesday (weekday = 2) at 10:00
      // 2026-10-27 is Tuesday.
      // Lead: 15 min -> remindAt = 09:45 local = 02:45 UTC = fixedNow!
      const slotId = '11111111-2222-4111-8111-111111111111';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slotId,
          weekday: 2,
          startTime: '10:00',
          endTime: '10:45',
          subject: 'Sinh học E2E',
          grade: '10A',
          room: 'P.302',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
        })
        .expect(201);

      // 3. First dispatch -> sends reminder
      const firstDispatch = await request(app.getHttpServer())
        .post('/internal/reminders/dispatch')
        .set('X-Cron-Secret', validCronSecret)
        .expect(200);

      expect(firstDispatch.body).toEqual({
        sent: 1,
        skipped: 0,
      });

      // Verify push sender received message
      expect(fakePushSender.getSentMessages()).toHaveLength(1);
      const sentMsg = fakePushSender.getSentMessages()[0];
      expect(sentMsg.payload.title).toBe('Tiết dạy: Sinh học E2E 10A');
      expect(sentMsg.payload.body).toBe('Bắt đầu lúc 10:00 tại P.302');
      expect(sentMsg.payload.url).toBe('/timetable?date=2026-10-27');

      // Verify DB record in sent_reminders
      const sentRecords = await prisma.sentReminder.findMany({
        where: { accountId },
      });
      expect(sentRecords).toHaveLength(1);
      expect(sentRecords[0].type).toBe('class_session');
      expect(sentRecords[0].targetId).toBe(`${slotId}:2026-10-27`);
      expect(sentRecords[0].remindAt).toEqual(fixedNow);

      // 4. Second dispatch -> idempotent (skip)
      const secondDispatch = await request(app.getHttpServer())
        .post('/internal/reminders/dispatch')
        .set('X-Cron-Secret', validCronSecret)
        .expect(200);

      expect(secondDispatch.body).toEqual({
        sent: 0,
        skipped: 1,
      });

      expect(fakePushSender.getSentMessages()).toHaveLength(1);
    });

    it('dispatches reminder for due ad-hoc class session', async () => {
      const { token, accountId } = await createTeacher('teacher-adhoc@example.com');

      await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/adhoc-device',
          keys: {
            p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
            auth: 'tBHItJI5svbpez7KI4CCXg',
          },
        })
        .expect(201);

      const adHocId = '22222222-3333-4111-8111-222222222222';
      await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: adHocId,
          date: '2026-10-27',
          startTime: '10:00',
          endTime: '10:45',
          subject: 'Dạy bù Vật lý E2E',
          grade: '11B',
          room: 'P.101',
          tone: 'mint',
        })
        .expect(201);

      const dispatchRes = await request(app.getHttpServer())
        .post('/internal/reminders/dispatch')
        .set('X-Cron-Secret', validCronSecret)
        .expect(200);

      expect(dispatchRes.body).toEqual({
        sent: 1,
        skipped: 0,
      });

      expect(fakePushSender.getSentMessages()).toHaveLength(1);
      const msg = fakePushSender.getSentMessages()[0];
      expect(msg.payload.title).toBe('Tiết dạy: Dạy bù Vật lý E2E 11B');
      expect(msg.payload.body).toBe('Bắt đầu lúc 10:00 tại P.101');
      expect(msg.payload.url).toBe('/timetable?date=2026-10-27');

      const sentRecords = await prisma.sentReminder.findMany({
        where: { accountId },
      });
      expect(sentRecords).toHaveLength(1);
      expect(sentRecords[0].type).toBe('class_session');
      expect(sentRecords[0].targetId).toBe(adHocId);
    });

    it('does not send reminder when class session is cancelled via override or ad-hoc is cancelled', async () => {
      const { token } = await createTeacher('teacher-cancelled@example.com');

      await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/cancelled-device',
          keys: {
            p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
            auth: 'tBHItJI5svbpez7KI4CCXg',
          },
        })
        .expect(201);

      // Create slot
      const slotId = '33333333-5555-4111-8111-333333333333';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slotId,
          weekday: 2,
          startTime: '10:00',
          endTime: '10:45',
          subject: 'Tiết bị huỷ',
          tone: 'rose',
          effectiveFrom: '2026-10-01',
        })
        .expect(201);

      // Cancel the session on 2026-10-27 via override
      await request(app.getHttpServer())
        .patch(`/class-sessions/${slotId}:2026-10-27`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          cancelled: true,
        })
        .expect(200);

      // Create an ad-hoc session that is cancelled
      await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: '44444444-6666-4111-8111-444444444444',
          date: '2026-10-27',
          startTime: '10:00',
          endTime: '10:45',
          subject: 'Buổi lẻ huỷ',
          tone: 'lavender',
          cancelled: true,
        })
        .expect(201);

      const dispatchRes = await request(app.getHttpServer())
        .post('/internal/reminders/dispatch')
        .set('X-Cron-Secret', validCronSecret)
        .expect(200);

      expect(dispatchRes.body.sent).toBe(0);
      expect(fakePushSender.getSentMessages()).toHaveLength(0);
    });

    it('formats class session reminder titles according to ScheduleCategory (school_teaching, extra_teaching, self_study)', async () => {
      const { token } = await createTeacher('teacher-categories@example.com');

      await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/categories-device',
          keys: {
            p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
            auth: 'tBHItJI5svbpez7KI4CCXg',
          },
        })
        .expect(201);

      // 1. TimetableSlot with extra_teaching on Tuesday 10:00
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: 'aaaa1111-1111-4111-8111-111111111111',
          weekday: 2,
          startTime: '10:00',
          endTime: '11:30',
          subject: 'Toán bồi dưỡng',
          grade: '9A',
          tone: 'lavender',
          category: 'extra_teaching',
          effectiveFrom: '2026-10-01',
        })
        .expect(201);

      // 2. Ad-hoc ClassSession with self_study on 2026-10-27 10:00
      await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: 'bbbb2222-2222-4111-8111-222222222222',
          date: '2026-10-27',
          startTime: '10:00',
          endTime: '11:30',
          subject: 'IELTS Academic',
          tone: 'mint',
          category: 'self_study',
        })
        .expect(201);

      const dispatchRes = await request(app.getHttpServer())
        .post('/internal/reminders/dispatch')
        .set('X-Cron-Secret', validCronSecret)
        .expect(200);

      expect(dispatchRes.body.sent).toBe(2);
      const titles = fakePushSender.getSentMessages().map((m) => m.payload.title);
      expect(titles).toContain('Ca dạy thêm: Toán bồi dưỡng 9A');
      expect(titles).toContain('Lịch học: IELTS Academic');
    });
  });

  describe('Dispatch Flow - Note Reminders & Midnight Boundary (S6-BE-01)', () => {
    it('dispatches reminder for Note with dueDate + remindTime (lead subtracted) and Note with only dueDate (at 07:00)', async () => {
      const { token, accountId } = await createTeacher('teacher-note@example.com');

      await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/note-device',
          keys: {
            p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
            auth: 'tBHItJI5svbpez7KI4CCXg',
          },
        })
        .expect(201);

      const timedNoteId = '55555555-5555-4111-8111-555555555555';
      const dateOnlyNoteId = '66666666-6666-4111-8111-666666666666';

      // Note 1: dueDate 2026-10-27 + remindTime 10:00 -> remindAt = 09:45 local = 02:45 UTC (fixedNow)
      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: timedNoteId,
          title: 'Nộp điểm E2E',
          dueDate: '2026-10-27',
          remindTime: '10:00',
        })
        .expect(201);

      // Note 2: dueDate 2026-10-27 without remindTime -> remindAt = 07:00 local = 00:00 UTC
      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: dateOnlyNoteId,
          title: 'Ghi chú đầu ngày E2E',
          dueDate: '2026-10-27',
        })
        .expect(201);

      // At fixedNow (02:45 UTC), Note 1 is due, Note 2 is >10m in the past (00:00 UTC)
      const firstDispatch = await request(app.getHttpServer())
        .post('/internal/reminders/dispatch')
        .set('X-Cron-Secret', validCronSecret)
        .expect(200);

      expect(firstDispatch.body).toEqual({
        sent: 1,
        skipped: 1,
      });

      expect(fakePushSender.getSentMessages()).toHaveLength(1);
      expect(fakePushSender.getSentMessages()[0].payload).toEqual({
        title: 'Nhắc nhở ghi chú: Nộp điểm E2E',
        body: '10:00',
        url: `/notes?noteId=${timedNoteId}`,
        tag: `note-${timedNoteId}-${fixedNow.getTime()}`,
        data: {
          type: 'note',
          id: timedNoteId,
          date: '2026-10-27',
          url: `/notes?noteId=${timedNoteId}`,
          remindAt: fixedNow.toISOString(),
        },
      });

      // Now move clock to 2026-10-27 07:00 local (00:00 UTC) -> Note 2 should fire!
      fakePushSender.clear();
      clock.set(new Date('2026-10-27T00:00:00.000Z'));

      const morningDispatch = await request(app.getHttpServer())
        .post('/internal/reminders/dispatch')
        .set('X-Cron-Secret', validCronSecret)
        .expect(200);

      expect(morningDispatch.body).toEqual({
        sent: 1,
        skipped: 1,
      });

      expect(fakePushSender.getSentMessages()).toHaveLength(1);
      expect(fakePushSender.getSentMessages()[0].payload.title).toBe(
        'Nhắc nhở ghi chú: Ghi chú đầu ngày E2E',
      );
      expect(fakePushSender.getSentMessages()[0].payload.body).toBe('07:00');
      expect(fakePushSender.getSentMessages()[0].payload.url).toBe(
        `/notes?noteId=${dateOnlyNoteId}`,
      );

      const sentRecords = await prisma.sentReminder.findMany({
        where: { accountId, type: 'note' },
      });
      expect(sentRecords).toHaveLength(2);
    });

    it('dispatches reminders across midnight boundary (00:05 tomorrow reminded at 23:50 today)', async () => {
      const { token } = await createTeacher('teacher-midnight@example.com');

      await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/midnight-device',
          keys: {
            p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
            auth: 'tBHItJI5svbpez7KI4CCXg',
          },
        })
        .expect(201);

      // Clock is 2026-10-27 23:50 local (Asia/Ho_Chi_Minh) = 2026-10-27T16:50:00.000Z
      clock.set(new Date('2026-10-27T16:50:00.000Z'));

      // Ad-hoc class session on 2026-10-28 at 00:05
      await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: '77777777-7777-4111-8111-777777777777',
          date: '2026-10-28',
          startTime: '00:05',
          endTime: '00:50',
          subject: 'Ca trực nửa đêm',
          tone: 'blue',
        })
        .expect(201);

      // Task on 2026-10-28 at 00:05
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: '88888888-8888-4111-8111-888888888888',
          title: 'Task sau nửa đêm',
          date: '2026-10-28',
          time: '00:05',
          category: 'school',
        })
        .expect(201);

      // Note on 2026-10-28 at 00:05
      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: '99999999-9999-4111-8111-999999999999',
          title: 'Note sau nửa đêm',
          dueDate: '2026-10-28',
          remindTime: '00:05',
        })
        .expect(201);

      const dispatchRes = await request(app.getHttpServer())
        .post('/internal/reminders/dispatch')
        .set('X-Cron-Secret', validCronSecret)
        .expect(200);

      expect(dispatchRes.body).toEqual({
        sent: 3,
        skipped: 0,
      });
      expect(fakePushSender.getSentMessages()).toHaveLength(3);
    });

    it('creates InAppNotification on dispatch even when teacher has no PushSubscription (S6-BE-02)', async () => {
      const { token } = await createTeacher('teacher-no-push-sub@example.com');

      clock.set(fixedNow);

      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: 'aaaaaaaa-aaaa-4111-8111-aaaaaaaaaaaa',
          title: 'Ghi chú chỉ nhận In-App',
          dueDate: '2026-10-27',
          remindTime: '10:00',
        })
        .expect(201);

      const dispatchRes = await request(app.getHttpServer())
        .post('/internal/reminders/dispatch')
        .set('X-Cron-Secret', validCronSecret)
        .expect(200);

      expect(dispatchRes.body).toEqual({
        sent: 1,
        skipped: 0,
      });
      expect(fakePushSender.getSentMessages()).toHaveLength(0);

      const notifRes = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(notifRes.body.unreadCount).toBe(1);
      expect(notifRes.body.items).toHaveLength(1);
      expect(notifRes.body.items[0].type).toBe('note');
      expect(notifRes.body.items[0].targetId).toBe('aaaaaaaa-aaaa-4111-8111-aaaaaaaaaaaa');
      expect(notifRes.body.items[0].url).toBe('/notes?noteId=aaaaaaaa-aaaa-4111-8111-aaaaaaaaaaaa');
    });
  });
});
