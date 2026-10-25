import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';

const MAILPIT_API = 'http://localhost:8025/api/v1';

async function clearMailpit(): Promise<void> {
  await fetch(`${MAILPIT_API}/messages`, { method: 'DELETE' });
}

async function getMailpitMessages(): Promise<any[]> {
  const res = await fetch(`${MAILPIT_API}/messages`);
  const data = (await res.json()) as any;
  return data.messages || [];
}

describe('Password Reset E2E (Mailpit Integration)', () => {
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
    await clearMailpit();
    await prisma.rateLimitCounter.deleteMany();
    await prisma.verificationCode.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.loginProvider.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.account.deleteMany();
  });

  afterAll(async () => {
    await clearMailpit();
    if (app) {
      await app.close();
    }
  });

  it('full flow: forgot password -> receives email -> resets password -> old sessions revoked -> login with new password', async () => {
    // 1. Register user
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'teacher.reset@cuteteachy.local',
        password: 'oldPassword123',
      })
      .expect(201);

    const oldRefreshToken = regRes.body.refreshToken;
    await clearMailpit();

    // 2. Request forgot password
    await request(app.getHttpServer())
      .post('/auth/password/forgot')
      .set('Accept-Language', 'vi-VN,vi;q=0.9')
      .send({ email: 'teacher.reset@cuteteachy.local' })
      .expect(204);

    // 3. Read reset email from Mailpit
    const messages = await getMailpitMessages();
    expect(messages.length).toBe(1);
    expect(messages[0].Subject.toLowerCase()).toContain('đặt lại mật khẩu');

    const codeMatch = messages[0].Subject.match(/\b\d{6}\b/) || messages[0].Snippet.match(/\b\d{6}\b/);
    expect(codeMatch).not.toBeNull();
    const resetCode = codeMatch![0];

    // 4. Validate reset password rejects short password (< 8 chars)
    await request(app.getHttpServer())
      .post('/auth/password/reset')
      .send({
        email: 'teacher.reset@cuteteachy.local',
        code: resetCode,
        newPassword: 'short',
      })
      .expect(400);

    // 5. Validate reset password rejects invalid code
    await request(app.getHttpServer())
      .post('/auth/password/reset')
      .send({
        email: 'teacher.reset@cuteteachy.local',
        code: '000000',
        newPassword: 'newStrongPassword456',
      })
      .expect(400);

    // 6. Reset password successfully
    await request(app.getHttpServer())
      .post('/auth/password/reset')
      .send({
        email: 'teacher.reset@cuteteachy.local',
        code: resetCode,
        newPassword: 'newStrongPassword456',
      })
      .expect(204);

    // 7. Old password no longer works
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'teacher.reset@cuteteachy.local',
        password: 'oldPassword123',
      })
      .expect(401);

    // 8. New password works
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'teacher.reset@cuteteachy.local',
        password: 'newStrongPassword456',
      })
      .expect(200);

    expect(loginRes.body.user.email).toBe('teacher.reset@cuteteachy.local');

    // 9. All previous refresh tokens revoked
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(401);
  });

  it('POST /auth/password/forgot returns timing-safe 204 for non-existent email without sending email', async () => {
    await request(app.getHttpServer())
      .post('/auth/password/forgot')
      .send({ email: 'ghost@cuteteachy.local' })
      .expect(204);

    const messages = await getMailpitMessages();
    expect(messages.length).toBe(0);
  });
});
