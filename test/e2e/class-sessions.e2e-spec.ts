import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';

describe('Class Sessions E2E (HTTP API with real Postgres)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.classSession.deleteMany();
    await prisma.timetableSlot.deleteMany();
    await prisma.taskTag.deleteMany();
    await prisma.task.deleteMany();
    await prisma.tag.deleteMany();
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

  async function createTeacher(
    email: string,
    completedOnboarding = true,
  ): Promise<{ token: string; accountId: string }> {
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);

    const token = registerRes.body.accessToken;
    const accountId = registerRes.body.user.id;

    if (completedOnboarding) {
      await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: 'Cô Lan', displayName: 'Lan', gender: 'female' })
        .expect(200);
    }

    return { token, accountId };
  }

  describe('Guards: Auth and Onboarding', () => {
    it('returns 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-01&to=2026-10-15')
        .expect(401);
    });

    it('returns 403 onboarding_required when teacher has not completed onboarding', async () => {
      const { token } = await createTeacher('not.onboarded@example.com', false);

      const res = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-01&to=2026-10-15')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.code).toBe('onboarding_required');
    });
  });

  describe('GET /class-sessions (Query Validation)', () => {
    it('returns 400 when from or to is missing', async () => {
      const { token } = await createTeacher('teacher@example.com');

      await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-01')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      await request(app.getHttpServer())
        .get('/class-sessions?to=2026-10-01')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns 400 when date range exceeds 42 days', async () => {
      const { token } = await createTeacher('teacher@example.com');

      const res = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-01&to=2026-11-13')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.code).toBe('validation');
    });

    it('returns 400 when from is after to', async () => {
      const { token } = await createTeacher('teacher@example.com');

      const res = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-15&to=2026-10-01')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.code).toBe('validation');
    });

    it('returns 400 when updatedSince is older than 30 days', async () => {
      const { token } = await createTeacher('teacher@example.com');
      const oldDate = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app.getHttpServer())
        .get(`/class-sessions?from=2026-10-01&to=2026-10-15&updatedSince=${encodeURIComponent(oldDate)}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.code).toBe('validation');
    });

    it('returns 400 when updatedSince is invalid date string', async () => {
      const { token } = await createTeacher('teacher@example.com');

      await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-01&to=2026-10-15&updatedSince=invalid-date')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('GET /class-sessions (Generation from Slots)', () => {
    it('generates sessions with stable IDs for effective slots in date range', async () => {
      const teacher1 = await createTeacher('teacher1@example.com');
      const teacher2 = await createTeacher('teacher2@example.com');

      // Slot 1 for teacher 1: Monday (weekday 1) 07:30–08:15, effective 2026-10-01 to 2026-10-31
      const slotId1 = '11111111-1111-4111-8111-111111111111';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send({
          id: slotId1,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          grade: '10A',
          room: '302',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          effectiveTo: '2026-10-31',
        })
        .expect(201);

      // Slot 2 for teacher 2: Monday 07:30-08:15 (teacher 2 should not bleed into teacher 1)
      const slotId2 = '22222222-2222-4222-8222-222222222222';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${teacher2.token}`)
        .send({
          id: slotId2,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Lịch sử',
          tone: 'mint',
          effectiveFrom: '2026-10-01',
        })
        .expect(201);

      // Query teacher 1 for week 2026-10-26 (Mon) to 2026-10-30 (Fri)
      const res1 = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-26&to=2026-10-30')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .expect(200);

      expect(res1.body.items).toHaveLength(1);
      const session = res1.body.items[0];
      expect(session.id).toBe(`${slotId1}:2026-10-26`);
      expect(session.timetableSlotId).toBe(slotId1);
      expect(session.date).toBe('2026-10-26');
      expect(session.startTime).toBe('07:30');
      expect(session.endTime).toBe('08:15');
      expect(session.subject).toBe('Sinh học');
      expect(session.grade).toBe('10A');
      expect(session.room).toBe('302');
      expect(session.tone).toBe('blue');
      expect(session.prepItems).toEqual([]);
      expect(session.cancelled).toBe(false);
      expect(session.updatedAt).toBeDefined();

      expect(res1.body.deletedIds).toEqual([]);
      expect(res1.body.serverTime).toBeDefined();

      // Read again: verify ID stability
      const res2 = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-26&to=2026-10-30')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .expect(200);

      expect(res2.body.items[0].id).toBe(session.id);

      // Query teacher 2: should get only teacher 2's session
      const resTeacher2 = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-26&to=2026-10-30')
        .set('Authorization', `Bearer ${teacher2.token}`)
        .expect(200);

      expect(resTeacher2.body.items).toHaveLength(1);
      expect(resTeacher2.body.items[0].id).toBe(`${slotId2}:2026-10-26`);
      expect(resTeacher2.body.items[0].subject).toBe('Lịch sử');
    });

    it('does not generate sessions outside effective date window', async () => {
      const { token } = await createTeacher('teacher@example.com');

      const slotId = '11111111-1111-4111-8111-111111111111';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slotId,
          weekday: 1, // Monday
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-20',
          effectiveTo: '2026-10-27',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-12&to=2026-11-05')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].date).toBe('2026-10-26');
    });
  });

  describe('POST /class-sessions (Create Ad-hoc Session)', () => {
    it('creates an ad-hoc session with 201, timetableSlotId = null, without slot conflict check', async () => {
      const { token } = await createTeacher('adhoc.teacher@example.com');

      // Create a slot for Monday 08:00 - 09:00
      const slotId = '33333333-3333-4333-8333-333333333333';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slotId,
          weekday: 1, // Monday
          startTime: '08:00',
          endTime: '09:00',
          subject: 'Slot môn chính',
          tone: 'lavender',
          effectiveFrom: '2026-10-01',
        })
        .expect(201);

      // Create ad-hoc session overlapping the exact same time (08:00 - 09:00 on Monday 2026-10-26)
      // Spec: ad-hoc session does NOT check conflict with slots!
      const adHocId = '44444444-4444-4444-8444-444444444444';
      const createRes = await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: adHocId,
          date: '2026-10-26',
          startTime: '08:00',
          endTime: '09:00',
          subject: 'Dạy bù đặc biệt',
          grade: '12B',
          room: 'Phòng thực hành',
          tone: 'rose',
          topic: 'Thực hành thí nghiệm',
          prepItems: [{ id: 'p1', label: 'Dụng cụ thí nghiệm', done: false }],
          cancelled: false,
        })
        .expect(201);

      expect(createRes.body.id).toBe(adHocId);
      expect(createRes.body.timetableSlotId).toBeNull();
      expect(createRes.body.subject).toBe('Dạy bù đặc biệt');
      expect(createRes.body.grade).toBe('12B');
      expect(createRes.body.room).toBe('Phòng thực hành');
      expect(createRes.body.tone).toBe('rose');
      expect(createRes.body.topic).toBe('Thực hành thí nghiệm');
      expect(createRes.body.prepItems).toHaveLength(1);
      expect(createRes.body.cancelled).toBe(false);

      // Idempotency: exact same payload returns 200 with same session
      const idempotentRes = await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: adHocId,
          date: '2026-10-26',
          startTime: '08:00',
          endTime: '09:00',
          subject: 'Dạy bù đặc biệt',
          grade: '12B',
          room: 'Phòng thực hành',
          tone: 'rose',
          topic: 'Thực hành thí nghiệm',
          prepItems: [{ id: 'p1', label: 'Dụng cụ thí nghiệm', done: false }],
          cancelled: false,
        })
        .expect(200);

      expect(idempotentRes.body.id).toBe(adHocId);

      // Conflict: same id but different payload returns 409 conflict
      const conflictRes = await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: adHocId,
          date: '2026-10-26',
          startTime: '08:00',
          endTime: '09:00',
          subject: 'Tên môn học khác',
          tone: 'rose',
        })
        .expect(409);

      expect(conflictRes.body.code).toBe('conflict');
    });

    it('returns 409 id_conflict when id belongs to another teacher', async () => {
      const teacher1 = await createTeacher('t1@example.com');
      const teacher2 = await createTeacher('t2@example.com');

      const adHocId = '55555555-5555-4555-8555-555555555555';
      await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send({
          id: adHocId,
          date: '2026-10-28',
          startTime: '08:00',
          endTime: '09:00',
          subject: 'Toán',
          tone: 'blue',
        })
        .expect(201);

      const conflictRes = await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${teacher2.token}`)
        .send({
          id: adHocId,
          date: '2026-10-28',
          startTime: '08:00',
          endTime: '09:00',
          subject: 'Toán',
          tone: 'blue',
        })
        .expect(409);

      expect(conflictRes.body.code).toBe('id_conflict');
    });

    it('returns 410 gone when attempting to create with a soft-deleted id', async () => {
      const { token } = await createTeacher('t3@example.com');
      const adHocId = '66666666-6666-4666-8666-666666666666';

      await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: adHocId,
          date: '2026-10-28',
          startTime: '08:00',
          endTime: '09:00',
          subject: 'Toán',
          tone: 'blue',
        })
        .expect(201);

      // Delete the session
      await request(app.getHttpServer())
        .delete(`/class-sessions/${adHocId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Re-create with same id -> 410 gone
      const goneRes = await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: adHocId,
          date: '2026-10-28',
          startTime: '08:00',
          endTime: '09:00',
          subject: 'Toán',
          tone: 'blue',
        })
        .expect(410);

      expect(goneRes.body.code).toBe('gone');
    });
  });

  describe('PATCH /class-sessions/:id (Generated Session Override)', () => {
    it('creates and updates override on generated session, accepts only topic, prepItems, cancelled', async () => {
      const { token } = await createTeacher('patch.slot@example.com');

      const slotId = '77777777-7777-4777-8777-777777777777';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slotId,
          weekday: 1, // Monday
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          grade: '10A',
          room: '302',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
        })
        .expect(201);

      const generatedId = `${slotId}:2026-10-26`;

      // 1. PATCH topic and prepItems
      const patchRes1 = await request(app.getHttpServer())
        .patch(`/class-sessions/${generatedId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          topic: 'Chương 1: Giới thiệu vi sinh vật',
          prepItems: [
            { id: 'prep-1', label: 'Mang lam kính', done: false },
            { id: 'prep-2', label: 'Chuẩn bị cồn', done: true },
          ],
        })
        .expect(200);

      expect(patchRes1.body.id).toBe(generatedId);
      expect(patchRes1.body.timetableSlotId).toBe(slotId);
      expect(patchRes1.body.topic).toBe('Chương 1: Giới thiệu vi sinh vật');
      expect(patchRes1.body.prepItems).toHaveLength(2);
      expect(patchRes1.body.prepItems[1].done).toBe(true);
      expect(patchRes1.body.cancelled).toBe(false);

      // 2. PATCH cancelled = true
      const patchRes2 = await request(app.getHttpServer())
        .patch(`/class-sessions/${generatedId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          cancelled: true,
        })
        .expect(200);

      expect(patchRes2.body.cancelled).toBe(true);
      expect(patchRes2.body.topic).toBe('Chương 1: Giới thiệu vi sinh vật'); // topic is preserved

      // 3. GET /class-sessions confirms cancelled = true is still returned in list
      const getRes = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-26&to=2026-10-30')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(getRes.body.items).toHaveLength(1);
      expect(getRes.body.items[0].id).toBe(generatedId);
      expect(getRes.body.items[0].cancelled).toBe(true);
      expect(getRes.body.items[0].topic).toBe('Chương 1: Giới thiệu vi sinh vật');

      // 4. Restore session: cancelled = false
      const restoreRes = await request(app.getHttpServer())
        .patch(`/class-sessions/${generatedId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          cancelled: false,
        })
        .expect(200);

      expect(restoreRes.body.cancelled).toBe(false);

      // 5. Attempting to change structural fields on generated session returns 400 validation error
      const invalidRes = await request(app.getHttpServer())
        .patch(`/class-sessions/${generatedId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          subject: 'Toán học',
        })
        .expect(400);

      expect(invalidRes.body.code).toBe('validation');
    });

    it('returns 404 when generated session does not match slot or effective dates', async () => {
      const { token } = await createTeacher('patch.invalid@example.com');

      const slotId = '88888888-8888-4888-8888-888888888888';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slotId,
          weekday: 1, // Monday
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-20',
          effectiveTo: '2026-10-27',
        })
        .expect(201);

      // Tuesday (wrong weekday)
      await request(app.getHttpServer())
        .patch(`/class-sessions/${slotId}:2026-10-27`)
        .set('Authorization', `Bearer ${token}`)
        .send({ topic: 'Test' })
        .expect(404);

      // Outside effectiveTo
      await request(app.getHttpServer())
        .patch(`/class-sessions/${slotId}:2026-11-02`)
        .set('Authorization', `Bearer ${token}`)
        .send({ topic: 'Test' })
        .expect(404);
    });
  });

  describe('PATCH /class-sessions/:id (Ad-hoc Session Update)', () => {
    it('allows updating all fields on an ad-hoc session', async () => {
      const { token } = await createTeacher('adhoc.patch@example.com');

      const adHocId = '99999999-9999-4999-8999-999999999999';
      await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: adHocId,
          date: '2026-10-27',
          startTime: '09:00',
          endTime: '10:00',
          subject: 'Dạy bù',
          tone: 'beige',
        })
        .expect(201);

      const updateRes = await request(app.getHttpServer())
        .patch(`/class-sessions/${adHocId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: '2026-10-28',
          startTime: '09:30',
          endTime: '10:30',
          subject: 'Dạy bù Toán',
          grade: '11A',
          room: 'P.201',
          tone: 'mint',
          topic: 'Hàm số lượng giác',
          prepItems: [{ id: 'p1', label: 'Bút dạ', done: false }],
          cancelled: true,
        })
        .expect(200);

      expect(updateRes.body.id).toBe(adHocId);
      expect(updateRes.body.date).toBe('2026-10-28');
      expect(updateRes.body.startTime).toBe('09:30');
      expect(updateRes.body.endTime).toBe('10:30');
      expect(updateRes.body.subject).toBe('Dạy bù Toán');
      expect(updateRes.body.grade).toBe('11A');
      expect(updateRes.body.room).toBe('P.201');
      expect(updateRes.body.tone).toBe('mint');
      expect(updateRes.body.topic).toBe('Hàm số lượng giác');
      expect(updateRes.body.prepItems).toHaveLength(1);
      expect(updateRes.body.cancelled).toBe(true);
    });
  });

  describe('DELETE /class-sessions/:id', () => {
    it('returns 400 cannot_delete_generated_session when attempting to delete a generated session', async () => {
      const { token } = await createTeacher('del.gen@example.com');

      const slotId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slotId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
        })
        .expect(201);

      const generatedId = `${slotId}:2026-10-26`;

      // Case 1: Session not yet overridden
      const res1 = await request(app.getHttpServer())
        .delete(`/class-sessions/${generatedId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res1.body.code).toBe('cannot_delete_generated_session');

      // Case 2: Session has override in DB
      await request(app.getHttpServer())
        .patch(`/class-sessions/${generatedId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ topic: 'Đã có override' })
        .expect(200);

      const res2 = await request(app.getHttpServer())
        .delete(`/class-sessions/${generatedId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res2.body.code).toBe('cannot_delete_generated_session');
    });

    it('soft deletes ad-hoc session with 204, excludes it from subsequent GET', async () => {
      const { token } = await createTeacher('del.adhoc@example.com');

      const adHocId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: adHocId,
          date: '2026-10-27',
          startTime: '09:00',
          endTime: '10:00',
          subject: 'Buổi lẻ cần xoá',
          tone: 'pink',
        })
        .expect(201);

      // Verify it appears in GET
      const getBefore = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-26&to=2026-10-30')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(getBefore.body.items).toHaveLength(1);

      // DELETE ad-hoc session
      await request(app.getHttpServer())
        .delete(`/class-sessions/${adHocId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Subsequent GET should not return the deleted ad-hoc session
      const getAfter = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-26&to=2026-10-30')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(getAfter.body.items).toHaveLength(0);

      // Idempotent delete returns 204
      await request(app.getHttpServer())
        .delete(`/class-sessions/${adHocId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });
  });

  describe('GET /class-sessions (Combined Generated + Overrides + Ad-hoc)', () => {
    it('returns generated sessions with overrides applied alongside ad-hoc sessions, properly sorted', async () => {
      const { token } = await createTeacher('combined@example.com');

      // Slot 1: Monday (2026-10-26) 07:30
      const slotId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slotId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học slot',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
        })
        .expect(201);

      // Override the Monday slot session with topic and cancelled = true
      const generatedId = `${slotId}:2026-10-26`;
      await request(app.getHttpServer())
        .patch(`/class-sessions/${generatedId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          topic: 'Buổi sinh học bị huỷ do họp chuyên môn',
          cancelled: true,
        })
        .expect(200);

      // Ad-hoc 1: Monday 07:00 (earlier time than slot)
      const adHocMondayEarly = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: adHocMondayEarly,
          date: '2026-10-26',
          startTime: '07:00',
          endTime: '07:30',
          subject: 'Chào cờ / Sinh hoạt',
          tone: 'rose',
        })
        .expect(201);

      // Ad-hoc 2: Tuesday 2026-10-27 08:00
      const adHocTuesday = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: adHocTuesday,
          date: '2026-10-27',
          startTime: '08:00',
          endTime: '09:00',
          subject: 'Dạy bù Toán',
          tone: 'mint',
        })
        .expect(201);

      // Query for the week
      const res = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-26&to=2026-10-30')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(3);

      // 1st: Monday 07:00 (adHocMondayEarly)
      expect(res.body.items[0].id).toBe(adHocMondayEarly);
      expect(res.body.items[0].startTime).toBe('07:00');
      expect(res.body.items[0].timetableSlotId).toBeNull();

      // 2nd: Monday 07:30 (generated with override applied)
      expect(res.body.items[1].id).toBe(generatedId);
      expect(res.body.items[1].startTime).toBe('07:30');
      expect(res.body.items[1].topic).toBe('Buổi sinh học bị huỷ do họp chuyên môn');
      expect(res.body.items[1].cancelled).toBe(true);

      // 3rd: Tuesday 08:00 (adHocTuesday)
      expect(res.body.items[2].id).toBe(adHocTuesday);
      expect(res.body.items[2].date).toBe('2026-10-27');
      expect(res.body.items[2].startTime).toBe('08:00');
    });
  });

  describe('GET /class-sessions (Delta Sync with updatedSince)', () => {
    it('returns only changed overrides and ad-hocs when no slot has changed', async () => {
      const { token } = await createTeacher('teacher.delta1@example.com');
      // Create slot S1: Monday (weekday 1) 07:30-08:15, effective 2026-10-01 to 2026-10-31
      const slotId = '11111111-1111-4111-8111-111111111111';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slotId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          effectiveTo: '2026-10-31',
        })
        .expect(201);

      // Create ad-hoc session A1: Wednesday 2026-10-28
      const adHoc1Id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: adHoc1Id,
          date: '2026-10-28',
          startTime: '09:00',
          endTime: '10:00',
          subject: 'Dạy bù cũ',
          tone: 'mint',
        })
        .expect(201);

      // Create ad-hoc session A2: Thursday 2026-10-29 (will be soft-deleted)
      const adHoc2Id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: adHoc2Id,
          date: '2026-10-29',
          startTime: '10:00',
          endTime: '11:00',
          subject: 'Buổi sắp bị xoá',
          tone: 'lavender',
        })
        .expect(201);

      // First sync to get checkpoint
      const firstSync = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-26&to=2026-10-31')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const checkpoint = firstSync.body.serverTime;
      await new Promise((r) => setTimeout(r, 100));

      // Override Monday session (slotId:2026-10-26)
      await request(app.getHttpServer())
        .patch(`/class-sessions/${slotId}:2026-10-26`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          topic: 'Chủ đề sau checkpoint',
          cancelled: true,
        })
        .expect(200);

      // Create new ad-hoc session A3: Friday 2026-10-30
      const adHoc3Id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      await request(app.getHttpServer())
        .post('/class-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: adHoc3Id,
          date: '2026-10-30',
          startTime: '14:00',
          endTime: '15:00',
          subject: 'Dạy bù mới sau sync',
          tone: 'rose',
        })
        .expect(201);

      // Delete ad-hoc session A2
      await request(app.getHttpServer())
        .delete(`/class-sessions/${adHoc2Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Delta sync query
      const deltaRes = await request(app.getHttpServer())
        .get(`/class-sessions?from=2026-10-26&to=2026-10-31&updatedSince=${encodeURIComponent(checkpoint)}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Items should contain only the changed override and changed ad-hoc A3
      expect(deltaRes.body.items).toHaveLength(2);
      expect(deltaRes.body.items[0].id).toBe(`${slotId}:2026-10-26`);
      expect(deltaRes.body.items[0].topic).toBe('Chủ đề sau checkpoint');
      expect(deltaRes.body.items[0].cancelled).toBe(true);
      expect(deltaRes.body.items[1].id).toBe(adHoc3Id);

      // DeletedIds should contain A2
      expect(deltaRes.body.deletedIds).toEqual([adHoc2Id]);
      expect(deltaRes.body.serverTime).toBeDefined();
    });

    it('returns all sessions in range when a slot was created after updatedSince', async () => {
      const { token } = await createTeacher('teacher.delta2@example.com');
      const initialRes = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-26&to=2026-10-31')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const checkpoint = initialRes.body.serverTime;
      await new Promise((r) => setTimeout(r, 100));

      // Create slot
      const slotId = '11111111-1111-4111-8111-111111111111';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slotId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          effectiveTo: '2026-10-31',
        })
        .expect(201);

      const deltaRes = await request(app.getHttpServer())
        .get(`/class-sessions?from=2026-10-26&to=2026-10-31&updatedSince=${encodeURIComponent(checkpoint)}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(deltaRes.body.items).toHaveLength(1);
      expect(deltaRes.body.items[0].id).toBe(`${slotId}:2026-10-26`);
      expect(deltaRes.body.deletedIds).toEqual([]);
    });

    it('returns all current sessions and deletedIds for defunct sessions when slot was ended/split', async () => {
      const { token } = await createTeacher('teacher.delta3@example.com');
      // Create slot S1 on Monday (weekday 1) effective 2026-10-01 to 2026-11-30
      const slotId = '11111111-1111-4111-8111-111111111111';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slotId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          effectiveTo: '2026-11-30',
        })
        .expect(201);

      // Checkpoint
      const syncRes = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-26&to=2026-11-08')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const checkpoint = syncRes.body.serverTime;
      await new Promise((r) => setTimeout(r, 100));

      // Split slot: update to Friday
      await request(app.getHttpServer())
        .patch(`/timetable-slots/${slotId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          weekday: 5,
        })
        .expect(200);

      // Query delta sync across 2 weeks
      const deltaRes = await request(app.getHttpServer())
        .get(`/class-sessions?from=2026-10-26&to=2026-11-08&updatedSince=${encodeURIComponent(checkpoint)}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(deltaRes.body.items.length).toBeGreaterThanOrEqual(1);

      // Defunct session: Monday session in week 2 from previous slot
      expect(deltaRes.body.deletedIds).toContain(`${slotId}:2026-11-02`);
    });

    it('returns deletedIds for all sessions of a slot when soft-deleted', async () => {
      const { token } = await createTeacher('teacher.delta4@example.com');
      // Create future slot (effectiveFrom in future so DELETE performs soft-delete)
      const futureFrom = '2026-11-01';
      const futureTo = '2026-11-30';
      const slotId = '11111111-1111-4111-8111-111111111111';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slotId,
          weekday: 1, // Monday
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Toán học tương lai',
          tone: 'mint',
          effectiveFrom: futureFrom,
          effectiveTo: futureTo,
        })
        .expect(201);

      const syncRes = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-11-01&to=2026-11-15')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const checkpoint = syncRes.body.serverTime;
      await new Promise((r) => setTimeout(r, 100));

      // Delete the slot (soft delete because no past sessions)
      await request(app.getHttpServer())
        .delete(`/timetable-slots/${slotId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Query delta sync
      const deltaRes = await request(app.getHttpServer())
        .get(`/class-sessions?from=2026-11-01&to=2026-11-15&updatedSince=${encodeURIComponent(checkpoint)}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(deltaRes.body.items).toHaveLength(0);
      // Mondays in 2026-11-01 to 2026-11-15: 2026-11-02 and 2026-11-09
      expect(deltaRes.body.deletedIds).toEqual([
        `${slotId}:2026-11-02`,
        `${slotId}:2026-11-09`,
      ].sort());
    });
  });
});
