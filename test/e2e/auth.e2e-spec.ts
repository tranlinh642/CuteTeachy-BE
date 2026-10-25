import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';

describe('Auth & Account E2E', () => {
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
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'teacher@example.com',
          password: 'correctPassword123',
        })
        .expect(201);
    });

    it('returns 200 AuthSession with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: '  TEACHER@EXAMPLE.COM ',
          password: 'correctPassword123',
          remember: false,
        })
        .expect(200);

      expect(res.body.user.email).toBe('teacher@example.com');
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('returns 401 invalid_credentials with wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'teacher@example.com',
          password: 'wrongPassword123',
        })
        .expect(401);

      expect(res.body.code).toBe('invalid_credentials');
    });

    it('returns 401 invalid_credentials with nonexistent email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'correctPassword123',
        })
        .expect(401);

      expect(res.body.code).toBe('invalid_credentials');
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates refresh token and returns new session', async () => {
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

      expect(refreshRes.body.user.email).toBe('teacher@example.com');
      expect(refreshRes.body.accessToken).toBeDefined();
      expect(refreshRes.body.refreshToken).toBeDefined();
      expect(refreshRes.body.refreshToken).not.toBe(oldRefreshToken);

      // Refreshing with the old token now fails (reuse detected)
      const reuseRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(401);

      expect(reuseRes.body.code).toBe('unauthorized');

      // Furthermore, reuse detection revokes all tokens of the account!
      // So the newer token is ALSO revoked:
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: refreshRes.body.refreshToken })
        .expect(401);
    });

    it('returns 401 unauthorized on non-existent token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'random-unknown-token-value' })
        .expect(401);

      expect(res.body.code).toBe('unauthorized');
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

      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: reg.body.refreshToken })
        .expect(204);

      // Now refresh with this token must fail
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: reg.body.refreshToken })
        .expect(401);
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
