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

      // Range covers:
      // 2026-10-12 (Mon - before effectiveFrom)
      // 2026-10-19 (Mon - before effectiveFrom)
      // 2026-10-26 (Mon - within effective window)
      // 2026-11-02 (Mon - after effectiveTo)
      const res = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-12&to=2026-11-05')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].date).toBe('2026-10-26');
    });
  });
});
