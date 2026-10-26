import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';
import { seedInspirations, SEED_INSPIRATIONS } from '../../prisma/seed';

describe('Inspiration E2E (HTTP API with real Postgres)', () => {
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
    await prisma.inspiration.deleteMany();
    await prisma.noteTag.deleteMany();
    await prisma.note.deleteMany();
    await prisma.taskTag.deleteMany();
    await prisma.task.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.settings.deleteMany();
    await prisma.rateLimitCounter.deleteMany();
    await prisma.verificationCode.deleteMany();
    await prisma.oneTimeExchangeCode.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.loginProvider.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.account.deleteMany();

    await seedInspirations(prisma);
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
    it('returns 401 Unauthorized when no JWT token is provided', async () => {
      const res = await request(app.getHttpServer()).get('/inspirations/today').expect(401);

      expect(res.body.code).toBe('unauthorized');
    });

    it('returns 403 Forbidden when onboarding is not completed', async () => {
      const email = `teacher-no-ob-${Date.now()}@example.com`;
      const { token } = await createTeacher(email, false);

      const res = await request(app.getHttpServer())
        .get('/inspirations/today')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.code).toBe('onboarding_required');
    });
  });

  describe('GET /inspirations/today', () => {
    it('returns 200 with today inspiration matching SPEC-003 schema', async () => {
      const email = `teacher-today-${Date.now()}@example.com`;
      const { token } = await createTeacher(email, true);

      const res = await request(app.getHttpServer())
        .get('/inspirations/today')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('quote');
      expect(res.body.quote).toHaveProperty('vi');
      expect(res.body.quote).toHaveProperty('en');
      expect(res.body).toHaveProperty('quoteVi');
      expect(res.body).toHaveProperty('quoteEn');
      expect(typeof res.body.id).toBe('string');
      expect(typeof res.body.quote.vi).toBe('string');
      expect(typeof res.body.quote.en).toBe('string');

      const knownIds = SEED_INSPIRATIONS.map((i) => i.id);
      expect(knownIds).toContain(res.body.id);
    });

    it('returns the identical quote when called repeatedly on the same day', async () => {
      const email = `teacher-repeat-${Date.now()}@example.com`;
      const { token } = await createTeacher(email, true);

      const res1 = await request(app.getHttpServer())
        .get('/inspirations/today')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const res2 = await request(app.getHttpServer())
        .get('/inspirations/today')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res1.body.id).toBe(res2.body.id);
      expect(res1.body.quoteVi).toBe(res2.body.quoteVi);
      expect(res1.body.quoteEn).toBe(res2.body.quoteEn);
    });

    it('returns quote with author when inspiration has an author', async () => {
      await prisma.inspiration.create({
        data: {
          id: 'insp-custom',
          quoteVi: 'Học, học nữa, học mãi.',
          quoteEn: 'Learn, learn more, learn forever.',
          author: 'V.I. Lenin',
        },
      });

      const email = `teacher-author-${Date.now()}@example.com`;
      const { token } = await createTeacher(email, true);

      const res = await request(app.getHttpServer())
        .get('/inspirations/today')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      if (res.body.id === 'insp-custom') {
        expect(res.body.author).toBe('V.I. Lenin');
      }
    });

    it('returns 404 when no inspirations exist in the database', async () => {
      const email = `teacher-empty-${Date.now()}@example.com`;
      const { token } = await createTeacher(email, true);

      await prisma.inspiration.deleteMany();

      const res = await request(app.getHttpServer())
        .get('/inspirations/today')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(res.body.code).toBe('not_found');
    });
  });
});
