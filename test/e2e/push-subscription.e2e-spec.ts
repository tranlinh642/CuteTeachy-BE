import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';

describe('Push Subscription E2E', () => {
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
    await prisma.pushSubscription.deleteMany();
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
        .send({ fullName: 'Cô Thuỷ', displayName: 'Thuỷ', gender: 'female' })
        .expect(200);
    }

    return { token, accountId };
  }

  describe('GET /push/vapid-public-key', () => {
    it('is public and returns 200 with publicKey without authentication', async () => {
      const res = await request(app.getHttpServer()).get('/push/vapid-public-key').expect(200);

      expect(res.body).toHaveProperty('publicKey');
      expect(typeof res.body.publicKey).toBe('string');
      expect(res.body.publicKey.length).toBeGreaterThan(0);
    });
  });

  describe('POST /push/subscriptions', () => {
    const sampleSubscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-teacher-1',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
    };

    it('returns 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .post('/push/subscriptions')
        .send(sampleSubscription)
        .expect(401);
    });

    it('returns 403 when onboarding is not completed', async () => {
      const { token } = await createTeacher('pending-onboarding@example.com', false);

      await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleSubscription)
        .expect(403);
    });

    it('returns 400 when payload is invalid (missing keys)', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({ endpoint: 'https://push.example.com' })
        .expect(400);
    });

    it('returns 201 Created on new subscription and saves to database', async () => {
      const { token, accountId } = await createTeacher('teacher-subscribed@example.com');

      const res = await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleSubscription)
        .expect(201);

      expect(res.body).toMatchObject({
        endpoint: sampleSubscription.endpoint,
        accountId,
        keys: sampleSubscription.keys,
      });
      expect(res.body.id).toBeDefined();

      const inDb = await prisma.pushSubscription.findUnique({
        where: { endpoint: sampleSubscription.endpoint },
      });
      expect(inDb).not.toBeNull();
      expect(inDb?.accountId).toBe(accountId);
      expect(inDb?.p256dh).toBe(sampleSubscription.keys.p256dh);
      expect(inDb?.auth).toBe(sampleSubscription.keys.auth);
    });

    it('returns 200 OK when same teacher upserts the same endpoint with updated keys', async () => {
      const { token, accountId } = await createTeacher('teacher-upsert@example.com');

      // First create (201)
      await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleSubscription)
        .expect(201);

      // Second post (200)
      const updatedKeys = {
        p256dh: 'updated-p256dh-key',
        auth: 'updated-auth-key',
      };

      const res = await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          endpoint: sampleSubscription.endpoint,
          keys: updatedKeys,
        })
        .expect(200);

      expect(res.body.accountId).toBe(accountId);
      expect(res.body.keys).toEqual(updatedKeys);

      const count = await prisma.pushSubscription.count({
        where: { endpoint: sampleSubscription.endpoint },
      });
      expect(count).toBe(1);

      const inDb = await prisma.pushSubscription.findUnique({
        where: { endpoint: sampleSubscription.endpoint },
      });
      expect(inDb?.p256dh).toBe('updated-p256dh-key');
    });

    it('reassigns endpoint to new teacher account when already registered by another account', async () => {
      const teacher1 = await createTeacher('teacher1@example.com');
      const teacher2 = await createTeacher('teacher2@example.com');

      // Teacher 1 registers device
      await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send(sampleSubscription)
        .expect(201);

      // Teacher 2 registers the same device endpoint
      const res = await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${teacher2.token}`)
        .send(sampleSubscription)
        .expect(200);

      expect(res.body.accountId).toBe(teacher2.accountId);

      // Teacher 1 no longer has the subscription
      const teacher1Subs = await prisma.pushSubscription.findMany({
        where: { accountId: teacher1.accountId },
      });
      expect(teacher1Subs).toHaveLength(0);

      // Teacher 2 now owns the subscription
      const teacher2Subs = await prisma.pushSubscription.findMany({
        where: { accountId: teacher2.accountId },
      });
      expect(teacher2Subs).toHaveLength(1);
      expect(teacher2Subs[0].endpoint).toBe(sampleSubscription.endpoint);
    });
  });

  describe('DELETE /push/subscriptions', () => {
    const sampleSubscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-to-delete',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
    };

    it('returns 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .delete('/push/subscriptions')
        .send({ endpoint: sampleSubscription.endpoint })
        .expect(401);
    });

    it('returns 204 No Content and deletes subscription from database', async () => {
      const { token } = await createTeacher('delete-sub@example.com');

      // First register
      await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleSubscription)
        .expect(201);

      // Delete
      await request(app.getHttpServer())
        .delete('/push/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({ endpoint: sampleSubscription.endpoint })
        .expect(204);

      const inDb = await prisma.pushSubscription.findUnique({
        where: { endpoint: sampleSubscription.endpoint },
      });
      expect(inDb).toBeNull();
    });

    it('returns 204 No Content even when endpoint does not exist (idempotent)', async () => {
      const { token } = await createTeacher('idempotent-delete@example.com');

      await request(app.getHttpServer())
        .delete('/push/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({ endpoint: 'https://fcm.googleapis.com/fcm/send/non-existent-device' })
        .expect(204);
    });

    it('does not delete a subscription owned by another teacher', async () => {
      const teacher1 = await createTeacher('owner@example.com');
      const teacher2 = await createTeacher('intruder@example.com');

      // Teacher 1 registers
      await request(app.getHttpServer())
        .post('/push/subscriptions')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send(sampleSubscription)
        .expect(201);

      // Teacher 2 tries to delete Teacher 1's subscription
      await request(app.getHttpServer())
        .delete('/push/subscriptions')
        .set('Authorization', `Bearer ${teacher2.token}`)
        .send({ endpoint: sampleSubscription.endpoint })
        .expect(204);

      // Subscription must still exist and belong to Teacher 1
      const inDb = await prisma.pushSubscription.findUnique({
        where: { endpoint: sampleSubscription.endpoint },
      });
      expect(inDb).not.toBeNull();
      expect(inDb?.accountId).toBe(teacher1.accountId);
    });
  });
});
