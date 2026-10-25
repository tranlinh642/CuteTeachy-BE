import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';
import { ExemptOnboarding } from '../../src/presentation/http/auth/exempt-onboarding.decorator';

@Controller('test-business')
class TestBusinessController {
  @Get('protected')
  protectedRoute() {
    return { ok: true };
  }

  @Get('exempt')
  @ExemptOnboarding()
  exemptRoute() {
    return { ok: true };
  }
}

@Module({
  imports: [AppModule],
  controllers: [TestBusinessController],
})
class TestAppModule {}

describe('Auth & Account E2E', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    // Clean up database tables before each test
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

  describe('POST /auth/register', () => {
    it('creates new account and returns 201 AuthSession', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: '  Teacher.Cute@example.com  ',
          password: 'password123',
          remember: true,
        })
        .expect(201);

      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('expiresAt');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('refreshExpiresAt');

      expect(res.body.user.email).toBe('teacher.cute@example.com');
      expect(res.body.user.emailVerified).toBe(false);
      expect(res.body.user.loginProviders).toEqual(['password']);
      expect(res.body.user.fullName).toBe('');
      expect(res.body.user.displayName).toBe('');
      expect(res.body.gender).toBeUndefined(); // User is nested in user property
      expect(res.body.user.gender).toBeNull();
      expect(res.body.user.onboardingCompletedAt).toBeNull();

      // Check DB
      const dbAccount = await prisma.account.findUnique({
        where: { email: 'teacher.cute@example.com' },
        include: { loginProviders: true, profile: true },
      });
      expect(dbAccount).not.toBeNull();
      expect(dbAccount?.loginProviders).toHaveLength(1);
      expect(dbAccount?.loginProviders[0].passwordHash).toContain('$argon2id$');
    });

    it('returns 409 email_taken when email already exists', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'teacher@example.com',
          password: 'password123',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'TEACHER@example.com',
          password: 'anotherPassword8',
        })
        .expect(409);

      expect(res.body.code).toBe('email_taken');
    });

    it('returns 400 validation when payload is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          password: 'short',
        })
        .expect(400);

      expect(res.body.code).toBe('validation');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'teacher@example.com',
        password: 'password123',
      });
    });

    it('returns 200 AuthSession with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'TEACHER@example.com',
          password: 'password123',
          remember: true,
        })
        .expect(200);

      expect(res.body.user.email).toBe('teacher@example.com');
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('returns 401 invalid_credentials with wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'teacher@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(res.body.code).toBe('invalid_credentials');
    });

    it('returns 401 invalid_credentials with non-existent email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);

      expect(res.body.code).toBe('invalid_credentials');
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates refresh token and returns new AuthSession', async () => {
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'teacher@example.com',
          password: 'password123',
        })
        .expect(201);

      const oldRefreshToken = reg.body.refreshToken;

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(200);

      expect(refreshRes.body).toHaveProperty('accessToken');
      expect(refreshRes.body).toHaveProperty('refreshToken');
      expect(refreshRes.body.refreshToken).not.toBe(oldRefreshToken);

      // Reusing revoked token should trigger theft detection and fail
      const reuseRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(401);

      expect(reuseRes.body.code).toBe('unauthorized');
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes refresh token and returns 204', async () => {
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'teacher@example.com',
          password: 'password123',
        })
        .expect(201);

      const refreshToken = reg.body.refreshToken;

      await request(app.getHttpServer()).post('/auth/logout').send({ refreshToken }).expect(204);

      // Using the revoked token to refresh should now fail
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(res.body.code).toBe('unauthorized');
    });

    it('returns 204 even if token does not exist', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: 'nonexistent-token' })
        .expect(204);
    });
  });

  describe('GET /auth/me', () => {
    it('returns User contract when authenticated with valid Bearer token', async () => {
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'teacher@example.com',
          password: 'password123',
        })
        .expect(201);

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .expect(200);

      expect(meRes.body.id).toBe(reg.body.user.id);
      expect(meRes.body.email).toBe('teacher@example.com');
      expect(meRes.body.emailVerified).toBe(false);
      expect(meRes.body.loginProviders).toEqual(['password']);
      expect(meRes.body.fullName).toBe('');
      expect(meRes.body.displayName).toBe('');
      expect(meRes.body.gender).toBeNull();
      expect(meRes.body.onboardingCompletedAt).toBeNull();
    });

    it('returns 401 unauthorized when Authorization header is missing', async () => {
      const res = await request(app.getHttpServer()).get('/auth/me').expect(401);
      expect(res.body.code).toBe('unauthorized');
    });

    it('returns 401 unauthorized when token is invalid', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
      expect(res.body.code).toBe('unauthorized');
    });
  });

  describe('PATCH /auth/profile', () => {
    it('returns 401 unauthorized when Authorization header is missing', async () => {
      const res = await request(app.getHttpServer())
        .patch('/auth/profile')
        .send({ fullName: 'Trần Đức Linh' })
        .expect(401);

      expect(res.body.code).toBe('unauthorized');
    });

    it('returns 400 validation when fullName is shorter than 2 characters', async () => {
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'val1@example.com', password: 'password123' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ fullName: 'A' })
        .expect(400);

      expect(res.body.code).toBe('validation');
    });

    it('returns 400 validation when fullName is longer than 50 characters', async () => {
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'val2@example.com', password: 'password123' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ fullName: 'A'.repeat(51) })
        .expect(400);

      expect(res.body.code).toBe('validation');
    });

    it('returns 400 validation when displayName is longer than 20 characters', async () => {
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'val3@example.com', password: 'password123' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ displayName: 'A'.repeat(21) })
        .expect(400);

      expect(res.body.code).toBe('validation');
    });

    it('returns 400 validation when title is longer than 100 characters', async () => {
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'val4@example.com', password: 'password123' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ title: 'A'.repeat(101) })
        .expect(400);

      expect(res.body.code).toBe('validation');
    });

    it('returns 400 validation when gender is invalid', async () => {
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'val5@example.com', password: 'password123' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ gender: 'unknown' })
        .expect(400);

      expect(res.body.code).toBe('validation');
    });

    it('deletes title when empty string or null is provided', async () => {
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'del-title@example.com', password: 'password123' })
        .expect(201);

      // Set initial title
      await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ title: 'Giáo viên Toán' })
        .expect(200);

      // Delete with empty string
      const resEmpty = await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ title: '   ' })
        .expect(200);

      expect(resEmpty.body.title).toBeUndefined();

      // Check DB
      const dbProfile1 = await prisma.profile.findUnique({
        where: { accountId: reg.body.user.id },
      });
      expect(dbProfile1?.title).toBeNull();

      // Re-set title
      await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ title: 'Giáo viên Lý' })
        .expect(200);

      // Delete with null
      const resNull = await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ title: null })
        .expect(200);

      expect(resNull.body.title).toBeUndefined();

      const dbProfile2 = await prisma.profile.findUnique({
        where: { accountId: reg.body.user.id },
      });
      expect(dbProfile2?.title).toBeNull();
    });
  });

  describe('OnboardingGuard & End-to-End Onboarding Lifecycle', () => {
    it('blocks business route with 403 onboarding_required until onboarding is completed, then allows 200', async () => {
      // 1. Register
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'lifecycle@example.com', password: 'password123' })
        .expect(201);

      const token = reg.body.accessToken;

      // 2. Route in /auth/* is NOT blocked even before onboarding
      const meBefore = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(meBefore.body.onboardingCompletedAt).toBeNull();

      // 3. Protected non-auth route returns 403 onboarding_required
      const blockedRes = await request(app.getHttpServer())
        .get('/test-business/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(blockedRes.body.code).toBe('onboarding_required');

      // 4. Route with @ExemptOnboarding() is allowed
      const exemptRes = await request(app.getHttpServer())
        .get('/test-business/exempt')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(exemptRes.body.ok).toBe(true);

      // 5. Partial update: missing gender -> still not completed
      const partialRes = await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fullName: 'Trần Đức Linh',
          displayName: 'Linh',
        })
        .expect(200);

      expect(partialRes.body.fullName).toBe('Trần Đức Linh');
      expect(partialRes.body.displayName).toBe('Linh');
      expect(partialRes.body.gender).toBeNull();
      expect(partialRes.body.onboardingCompletedAt).toBeNull();

      // Still blocked
      await request(app.getHttpServer())
        .get('/test-business/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      // 6. Complete onboarding: provide gender
      const completedRes = await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          gender: 'male',
          title: 'Thầy Linh',
        })
        .expect(200);

      expect(completedRes.body.gender).toBe('male');
      expect(completedRes.body.title).toBe('Thầy Linh');
      expect(completedRes.body.onboardingCompletedAt).not.toBeNull();
      const firstCompletedAt = completedRes.body.onboardingCompletedAt;

      // 7. GET /auth/me now reflects completed onboarding
      const meAfter = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(meAfter.body.fullName).toBe('Trần Đức Linh');
      expect(meAfter.body.displayName).toBe('Linh');
      expect(meAfter.body.gender).toBe('male');
      expect(meAfter.body.title).toBe('Thầy Linh');
      expect(meAfter.body.onboardingCompletedAt).toBe(firstCompletedAt);

      // 8. Protected non-auth route now returns 200
      const allowedRes = await request(app.getHttpServer())
        .get('/test-business/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(allowedRes.body.ok).toBe(true);

      // 9. Further profile updates do NOT change onboardingCompletedAt
      const updateAgainRes = await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Giáo viên Chủ nhiệm',
        })
        .expect(200);

      expect(updateAgainRes.body.title).toBe('Giáo viên Chủ nhiệm');
      expect(updateAgainRes.body.onboardingCompletedAt).toBe(firstCompletedAt);
    });
  });

  describe('Rate Limiting (429 rate_limited)', () => {
    it('returns 429 rate_limited when IP exceeds threshold on login', async () => {
      await prisma.rateLimitCounter.create({
        data: {
          key: 'login:127.0.0.1',
          count: 10,
          expiresAt: new Date(Date.now() + 60000),
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'teacher@example.com',
          password: 'password123',
        })
        .expect(429);

      expect(res.body.code).toBe('rate_limited');
    });

    it('returns 429 rate_limited when IP exceeds threshold on register', async () => {
      await prisma.rateLimitCounter.create({
        data: {
          key: 'register:127.0.0.1',
          count: 10,
          expiresAt: new Date(Date.now() + 60000),
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'another@example.com',
          password: 'password123',
        })
        .expect(429);

      expect(res.body.code).toBe('rate_limited');
    });

    it('returns 429 rate_limited when IP exceeds threshold on refresh', async () => {
      await prisma.rateLimitCounter.create({
        data: {
          key: 'refresh:127.0.0.1',
          count: 10,
          expiresAt: new Date(Date.now() + 60000),
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: 'dummy-token',
        })
        .expect(429);

      expect(res.body.code).toBe('rate_limited');
    });
  });
});
