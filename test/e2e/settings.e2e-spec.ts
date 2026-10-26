import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';

describe('Settings E2E (HTTP API with real Postgres)', () => {
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
    await prisma.settings.deleteMany();
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
    acceptLanguage?: string,
  ): Promise<{ token: string; accountId: string }> {
    const req = request(app.getHttpServer()).post('/auth/register');
    if (acceptLanguage) {
      req.set('Accept-Language', acceptLanguage);
    }
    const registerRes = await req.send({ email, password: 'password123' }).expect(201);

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

  describe('Guards: Auth and Onboarding exemption', () => {
    it('returns 401 when no token is provided for GET /me/settings', async () => {
      await request(app.getHttpServer()).get('/me/settings').expect(401);
    });

    it('returns 401 when no token is provided for PATCH /me/settings', async () => {
      await request(app.getHttpServer())
        .patch('/me/settings')
        .send({ locale: 'en' })
        .expect(401);
    });

    it('allows GET /me/settings even when onboarding is not completed', async () => {
      const { token } = await createTeacher('not.onboarded@example.com', false);

      const res = await request(app.getHttpServer())
        .get('/me/settings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({
        locale: 'vi',
        timeZone: 'Asia/Ho_Chi_Minh',
        pushEnabled: true,
        reminderLeadMinutes: 15,
      });
    });

    it('allows PATCH /me/settings even when onboarding is not completed (FE sends timeZone during onboarding)', async () => {
      const { token } = await createTeacher('onboarding.user@example.com', false);

      const res = await request(app.getHttpServer())
        .patch('/me/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ timeZone: 'America/New_York' })
        .expect(200);

      expect(res.body.timeZone).toBe('America/New_York');
    });
  });

  describe('Default settings on registration', () => {
    it('creates default settings with vi locale when Accept-Language is missing or Vietnamese', async () => {
      const { token } = await createTeacher('teacher.vn@example.com', true, 'vi-VN,vi;q=0.9');

      const res = await request(app.getHttpServer())
        .get('/me/settings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({
        locale: 'vi',
        timeZone: 'Asia/Ho_Chi_Minh',
        pushEnabled: true,
        reminderLeadMinutes: 15,
      });
    });

    it('creates default settings with en locale when Accept-Language is English', async () => {
      const { token } = await createTeacher('teacher.en@example.com', true, 'en-US,en;q=0.9');

      const res = await request(app.getHttpServer())
        .get('/me/settings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({
        locale: 'en',
        timeZone: 'Asia/Ho_Chi_Minh',
        pushEnabled: true,
        reminderLeadMinutes: 15,
      });
    });
  });

  describe('PATCH /me/settings (Partial updates and validations)', () => {
    it('updates locale, timeZone, pushEnabled, and reminderLeadMinutes partially', async () => {
      const { token } = await createTeacher('teacher.patch@example.com');

      // 1. Update locale
      const res1 = await request(app.getHttpServer())
        .patch('/me/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ locale: 'en' })
        .expect(200);

      expect(res1.body).toEqual({
        locale: 'en',
        timeZone: 'Asia/Ho_Chi_Minh',
        pushEnabled: true,
        reminderLeadMinutes: 15,
      });

      // 2. Update timeZone
      const res2 = await request(app.getHttpServer())
        .patch('/me/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ timeZone: 'Asia/Tokyo' })
        .expect(200);

      expect(res2.body).toEqual({
        locale: 'en',
        timeZone: 'Asia/Tokyo',
        pushEnabled: true,
        reminderLeadMinutes: 15,
      });

      // 3. Update pushEnabled and reminderLeadMinutes
      const res3 = await request(app.getHttpServer())
        .patch('/me/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ pushEnabled: false, reminderLeadMinutes: 60 })
        .expect(200);

      expect(res3.body).toEqual({
        locale: 'en',
        timeZone: 'Asia/Tokyo',
        pushEnabled: false,
        reminderLeadMinutes: 60,
      });

      // 4. Verify with GET
      const getRes = await request(app.getHttpServer())
        .get('/me/settings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(getRes.body).toEqual({
        locale: 'en',
        timeZone: 'Asia/Tokyo',
        pushEnabled: false,
        reminderLeadMinutes: 60,
      });
    });

    it('rejects invalid locale with 400 validation', async () => {
      const { token } = await createTeacher('teacher.val1@example.com');

      const res = await request(app.getHttpServer())
        .patch('/me/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ locale: 'fr' })
        .expect(400);

      expect(res.body.code).toBe('validation');
    });

    it('rejects invalid timeZone with 400 validation', async () => {
      const { token } = await createTeacher('teacher.val2@example.com');

      const res = await request(app.getHttpServer())
        .patch('/me/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ timeZone: 'Mars/Base' })
        .expect(400);

      expect(res.body.code).toBe('validation');
    });

    it('rejects invalid reminderLeadMinutes with 400 validation', async () => {
      const { token } = await createTeacher('teacher.val3@example.com');

      for (const invalidMins of [0, 20, 45, 90]) {
        const res = await request(app.getHttpServer())
          .patch('/me/settings')
          .set('Authorization', `Bearer ${token}`)
          .send({ reminderLeadMinutes: invalidMins })
          .expect(400);

        expect(res.body.code).toBe('validation');
      }
    });

    it('rejects non-boolean pushEnabled with 400 validation', async () => {
      const { token } = await createTeacher('teacher.val4@example.com');

      const res = await request(app.getHttpServer())
        .patch('/me/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ pushEnabled: 'yes' })
        .expect(400);

      expect(res.body.code).toBe('validation');
    });
  });

  describe('Isolation between teachers', () => {
    it('keeps settings isolated per teacher', async () => {
      const teacherA = await createTeacher('teacher.a@example.com');
      const teacherB = await createTeacher('teacher.b@example.com');

      await request(app.getHttpServer())
        .patch('/me/settings')
        .set('Authorization', `Bearer ${teacherA.token}`)
        .send({ locale: 'en', timeZone: 'Europe/Paris', reminderLeadMinutes: 30 })
        .expect(200);

      // Teacher A has updated settings
      const resA = await request(app.getHttpServer())
        .get('/me/settings')
        .set('Authorization', `Bearer ${teacherA.token}`)
        .expect(200);

      expect(resA.body).toEqual({
        locale: 'en',
        timeZone: 'Europe/Paris',
        pushEnabled: true,
        reminderLeadMinutes: 30,
      });

      // Teacher B still has default settings
      const resB = await request(app.getHttpServer())
        .get('/me/settings')
        .set('Authorization', `Bearer ${teacherB.token}`)
        .expect(200);

      expect(resB.body).toEqual({
        locale: 'vi',
        timeZone: 'Asia/Ho_Chi_Minh',
        pushEnabled: true,
        reminderLeadMinutes: 15,
      });
    });
  });
});
