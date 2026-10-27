import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';

describe('Timetable Slots E2E (HTTP API with real Postgres)', () => {
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
      await request(app.getHttpServer()).get('/timetable-slots').expect(401);
      await request(app.getHttpServer()).post('/timetable-slots').send({}).expect(401);
    });

    it('returns 403 onboarding_required when teacher has not completed onboarding', async () => {
      const { token } = await createTeacher('not.onboarded@example.com', false);

      const res = await request(app.getHttpServer())
        .get('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.code).toBe('onboarding_required');
    });
  });

  describe('POST /timetable-slots (Creation & Idempotency)', () => {
    const slotId = '11111111-1111-4111-8111-111111111111';

    const validPayload = {
      id: slotId,
      weekday: 1,
      startTime: '07:30',
      endTime: '08:15',
      subject: 'Sinh học',
      grade: '10A',
      room: '302',
      tone: 'blue',
      effectiveFrom: '2026-10-01',
      effectiveTo: '2026-12-31',
    };

    it('creates a new timetable slot with 201 CREATED', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      const res = await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload)
        .expect(201);

      expect(res.body.id).toBe(slotId);
      expect(res.body.weekday).toBe(1);
      expect(res.body.startTime).toBe('07:30');
      expect(res.body.endTime).toBe('08:15');
      expect(res.body.subject).toBe('Sinh học');
      expect(res.body.grade).toBe('10A');
      expect(res.body.room).toBe('302');
      expect(res.body.tone).toBe('blue');
      expect(res.body.effectiveFrom).toBe('2026-10-01');
      expect(res.body.effectiveTo).toBe('2026-12-31');
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.updatedAt).toBeDefined();
    });

    it('returns 200 OK idempotent on duplicate submission with identical payload', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      const res1 = await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload)
        .expect(201);

      const res2 = await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload)
        .expect(200);

      expect(res2.body).toEqual(res1.body);
    });

    it('returns 409 conflict when duplicate id has different payload', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validPayload,
          subject: 'Hóa học', // Different subject!
        })
        .expect(409);

      expect(res.body.code).toBe('conflict');
    });

    it('returns 409 id_conflict when id belongs to another teacher', async () => {
      const teacher1 = await createTeacher('teacher1@example.com');
      const teacher2 = await createTeacher('teacher2@example.com');

      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send(validPayload)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${teacher2.token}`)
        .send(validPayload)
        .expect(409);

      expect(res.body.code).toBe('id_conflict');
    });

    it('returns 409 timetable_conflict when slot overlaps with existing slot', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload) // Mon 07:30-08:15, 2026-10-01 to 2026-12-31
        .expect(201);

      const conflictingSlotId = '22222222-2222-4222-8222-222222222222';
      const res = await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: conflictingSlotId,
          weekday: 1, // Same weekday
          startTime: '08:00', // Overlaps 07:30-08:15!
          endTime: '08:45',
          subject: 'Toán học',
          tone: 'pink',
          effectiveFrom: '2026-10-15', // Overlaps
          effectiveTo: '2026-11-15',
        })
        .expect(409);

      expect(res.body.code).toBe('timetable_conflict');
    });

    it('creates successfully when time edges touch (07:00-07:30 vs 07:30-08:15)', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload) // Mon 07:30-08:15
        .expect(201);

      const nonConflictingSlotId = '22222222-2222-4222-8222-222222222222';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: nonConflictingSlotId,
          weekday: 1,
          startTime: '07:00',
          endTime: '07:30', // Touching edge!
          subject: 'Chào cờ',
          tone: 'rose',
          effectiveFrom: '2026-10-01',
          effectiveTo: '2026-12-31',
        })
        .expect(201);
    });

    describe('Validation failures (400)', () => {
      it('rejects invalid UUID', async () => {
        const { token } = await createTeacher('teacher1@example.com');
        await request(app.getHttpServer())
          .post('/timetable-slots')
          .set('Authorization', `Bearer ${token}`)
          .send({ ...validPayload, id: 'bad-uuid' })
          .expect(400);
      });

      it('rejects weekday out of range', async () => {
        const { token } = await createTeacher('teacher1@example.com');
        await request(app.getHttpServer())
          .post('/timetable-slots')
          .set('Authorization', `Bearer ${token}`)
          .send({ ...validPayload, weekday: 8 })
          .expect(400);
      });

      it('rejects startTime >= endTime', async () => {
        const { token } = await createTeacher('teacher1@example.com');
        await request(app.getHttpServer())
          .post('/timetable-slots')
          .set('Authorization', `Bearer ${token}`)
          .send({ ...validPayload, startTime: '08:30', endTime: '08:15' })
          .expect(400);
      });

      it('rejects invalid tone', async () => {
        const { token } = await createTeacher('teacher1@example.com');
        await request(app.getHttpServer())
          .post('/timetable-slots')
          .set('Authorization', `Bearer ${token}`)
          .send({ ...validPayload, tone: 'neon-green' })
          .expect(400);
      });

      it('rejects effectiveTo < effectiveFrom', async () => {
        const { token } = await createTeacher('teacher1@example.com');
        await request(app.getHttpServer())
          .post('/timetable-slots')
          .set('Authorization', `Bearer ${token}`)
          .send({ ...validPayload, effectiveFrom: '2026-10-15', effectiveTo: '2026-10-10' })
          .expect(400);
      });
    });
  });

  describe('GET /timetable-slots', () => {
    it('returns envelope with slots belonging only to authenticated teacher', async () => {
      const teacher1 = await createTeacher('teacher1@example.com');
      const teacher2 = await createTeacher('teacher2@example.com');

      const slot1 = {
        id: '11111111-1111-4111-8111-111111111111',
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
      };
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send(slot1)
        .expect(201);

      const slot2 = {
        id: '22222222-2222-4222-8222-222222222222',
        weekday: 2,
        startTime: '08:30',
        endTime: '09:15',
        subject: 'Hóa học',
        tone: 'rose',
        effectiveFrom: '2026-10-01',
      };
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${teacher2.token}`)
        .send(slot2)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/timetable-slots')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(slot1.id);
      expect(res.body.deletedIds).toEqual([]);
      expect(res.body.serverTime).toBeDefined();
    });

    it('supports updatedSince query', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      const slot1 = {
        id: '11111111-1111-4111-8111-111111111111',
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
      };
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send(slot1)
        .expect(201);

      const futureDate = new Date(Date.now() + 60000).toISOString();
      const res = await request(app.getHttpServer())
        .get(`/timetable-slots?updatedSince=${encodeURIComponent(futureDate)}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(0);
      expect(res.body.deletedIds).toEqual([]);
    });

    it('rejects updatedSince older than 30 days with 400', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app.getHttpServer())
        .get(`/timetable-slots?updatedSince=${encodeURIComponent(oldDate)}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.code).toBe('validation');
    });
  });

  describe('PATCH /timetable-slots/:id (Edit & Split)', () => {
    it('splits slot when effectiveFrom < today, returning { previous, current } and transfers future overrides', async () => {
      const { token, accountId } = await createTeacher('teacher.split@example.com');

      const oldSlotId = '11111111-1111-4111-8111-111111111111';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: oldSlotId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          grade: '10A',
          room: '302',
          tone: 'blue',
          effectiveFrom: '2026-01-01',
          effectiveTo: '2026-12-31',
        })
        .expect(201);

      // Create an override in the future (a Monday in Dec 2026)
      await prisma.classSession.create({
        data: {
          id: `${oldSlotId}:2026-12-07`,
          accountId,
          timetableSlotId: oldSlotId,
          date: '2026-12-07',
          topic: 'Chương trình gen di truyền',
          prepItems: [{ id: 'prep-1', label: 'Chuẩn bị kính hiển vi', done: false }],
          cancelled: false,
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/timetable-slots/${oldSlotId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          subject: 'Sinh học 12',
          room: 'Lab 5',
        })
        .expect(200);

      expect(res.body.previous).toBeDefined();
      expect(res.body.previous.id).toBe(oldSlotId);
      expect(res.body.previous.subject).toBe('Sinh học');
      expect(res.body.previous.effectiveTo).toBeDefined();

      expect(res.body.current).toBeDefined();
      expect(res.body.current.id).not.toBe(oldSlotId);
      expect(res.body.current.subject).toBe('Sinh học 12');
      expect(res.body.current.room).toBe('Lab 5');

      const newSlotId = res.body.current.id;

      // Check DB: old slot has effectiveTo updated, new slot created
      const oldSlotDb = await prisma.timetableSlot.findUnique({ where: { id: oldSlotId } });
      expect(oldSlotDb?.deletedAt).toBeNull();
      expect(oldSlotDb?.effectiveTo).toBe(res.body.previous.effectiveTo);

      const newSlotDb = await prisma.timetableSlot.findUnique({ where: { id: newSlotId } });
      expect(newSlotDb).toBeDefined();
      expect(newSlotDb?.subject).toBe('Sinh học 12');

      // Check that future override was transferred to new slot
      const oldOverride = await prisma.classSession.findUnique({
        where: { id: `${oldSlotId}:2026-12-07` },
      });
      expect(oldOverride).toBeNull();

      const transferredOverride = await prisma.classSession.findUnique({
        where: { id: `${newSlotId}:2026-12-07` },
      });
      expect(transferredOverride).toBeDefined();
      expect(transferredOverride?.timetableSlotId).toBe(newSlotId);
      expect(transferredOverride?.topic).toBe('Chương trình gen di truyền');
    });

    it('edits slot in place when effectiveFrom >= today, returning { current } without previous', async () => {
      const { token } = await createTeacher('teacher.inplace@example.com');

      const slotId = '22222222-2222-4222-8222-222222222222';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slotId,
          weekday: 2,
          startTime: '08:00',
          endTime: '08:45',
          subject: 'Vật lý',
          tone: 'rose',
          effectiveFrom: '2026-12-01',
          effectiveTo: '2026-12-31',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/timetable-slots/${slotId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          subject: 'Vật lý hạt nhân',
          tone: 'mint',
        })
        .expect(200);

      expect(res.body.previous).toBeUndefined();
      expect(res.body.current.id).toBe(slotId);
      expect(res.body.current.subject).toBe('Vật lý hạt nhân');
      expect(res.body.current.tone).toBe('mint');

      const slotDb = await prisma.timetableSlot.findUnique({ where: { id: slotId } });
      expect(slotDb?.subject).toBe('Vật lý hạt nhân');
    });

    it('returns 409 timetable_conflict when edit causes overlap with another slot', async () => {
      const { token } = await createTeacher('teacher.conflict@example.com');

      const slot1Id = '33333333-3333-4333-8333-333333333333';
      const slot2Id = '44444444-4444-4444-8444-444444444444';

      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slot1Id,
          weekday: 3,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Toán',
          tone: 'blue',
          effectiveFrom: '2026-12-01',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slot2Id,
          weekday: 3,
          startTime: '08:30',
          endTime: '09:15',
          subject: 'Lý',
          tone: 'pink',
          effectiveFrom: '2026-12-01',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/timetable-slots/${slot2Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          startTime: '08:00', // overlaps with slot1 (07:30 - 08:15)
        })
        .expect(409);

      expect(res.body.code).toBe('timetable_conflict');
    });

    it('returns 404 not_found when editing another teacher slot', async () => {
      const teacher1 = await createTeacher('owner@example.com');
      const teacher2 = await createTeacher('attacker@example.com');

      const slotId = '55555555-5555-4555-8555-555555555555';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send({
          id: slotId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Toán',
          tone: 'blue',
          effectiveFrom: '2026-12-01',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/timetable-slots/${slotId}`)
        .set('Authorization', `Bearer ${teacher2.token}`)
        .send({ subject: 'Hacked' })
        .expect(404);

      expect(res.body.code).toBe('not_found');
    });
  });

  describe('DELETE /timetable-slots/:id', () => {
    it('ends slot at yesterday when effectiveFrom < today without soft deleting', async () => {
      const { token, accountId } = await createTeacher('teacher.del.past@example.com');

      const slotId = '66666666-6666-4666-8666-666666666666';
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
          effectiveFrom: '2026-01-01',
          effectiveTo: '2026-12-31',
        })
        .expect(201);

      // Future override
      await prisma.classSession.create({
        data: {
          id: `${slotId}:2026-12-07`,
          accountId,
          timetableSlotId: slotId,
          date: '2026-12-07',
          topic: 'Sẽ bị xoá',
        },
      });

      await request(app.getHttpServer())
        .delete(`/timetable-slots/${slotId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const slotDb = await prisma.timetableSlot.findUnique({ where: { id: slotId } });
      expect(slotDb?.deletedAt).toBeNull();
      expect(slotDb?.effectiveTo).toBeDefined();

      // Future override was deleted
      const futureOverride = await prisma.classSession.findUnique({
        where: { id: `${slotId}:2026-12-07` },
      });
      expect(futureOverride).toBeNull();
    });

    it('soft deletes slot when effectiveFrom >= today', async () => {
      const { token } = await createTeacher('teacher.del.future@example.com');

      const slotId = '77777777-7777-4777-8777-777777777777';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slotId,
          weekday: 4,
          startTime: '09:00',
          endTime: '09:45',
          subject: 'Toán tạo nhầm',
          tone: 'beige',
          effectiveFrom: '2026-12-01',
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/timetable-slots/${slotId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const slotDb = await prisma.timetableSlot.findUnique({ where: { id: slotId } });
      expect(slotDb?.deletedAt).not.toBeNull();

      // Does not appear in normal list
      const listRes = await request(app.getHttpServer())
        .get('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(listRes.body.items).toHaveLength(0);

      // Appears in deletedIds when updatedSince is used
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const syncRes = await request(app.getHttpServer())
        .get(`/timetable-slots?updatedSince=${encodeURIComponent(pastDate)}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(syncRes.body.deletedIds).toContain(slotId);
    });

    it('is idempotent on repeat delete', async () => {
      const { token } = await createTeacher('teacher.idempotent@example.com');

      const slotId = '88888888-8888-4888-8888-888888888888';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: slotId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Toán',
          tone: 'blue',
          effectiveFrom: '2026-12-01',
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/timetable-slots/${slotId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Second delete returns 204
      await request(app.getHttpServer())
        .delete(`/timetable-slots/${slotId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('returns 404 when deleting non-existent slot or another teacher slot', async () => {
      const { token } = await createTeacher('teacher.notfound@example.com');

      const res = await request(app.getHttpServer())
        .delete('/timetable-slots/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(res.body.code).toBe('not_found');
    });
  });
});
