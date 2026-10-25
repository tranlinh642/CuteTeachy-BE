import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';
import { APP_CONFIG } from '../../src/infrastructure/config/app.config';

const MAILPIT_API = 'http://localhost:8025/api/v1';

async function clearMailpit(): Promise<void> {
  await fetch(`${MAILPIT_API}/messages`, { method: 'DELETE' });
}

async function getMailpitMessages(): Promise<any[]> {
  const res = await fetch(`${MAILPIT_API}/messages`);
  const data = (await res.json()) as any;
  return data.messages || [];
}

describe('Email Verification E2E (Mailpit Integration)', () => {
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

  it('registration sends verification email to Mailpit; POST /auth/email/verify validates code and updates emailVerified', async () => {
    // 1. Register new user
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Accept-Language', 'vi-VN,vi;q=0.9')
      .send({
        email: 'teacher.verify@cuteteachy.local',
        password: 'password123',
      })
      .expect(201);

    expect(regRes.body.user.emailVerified).toBe(false);

    // 2. Read sent email from Mailpit
    const messages = await getMailpitMessages();
    expect(messages.length).toBeGreaterThanOrEqual(1);

    const emailMsg = messages.find(
      (m) => m.To && m.To.some((t: any) => t.Address === 'teacher.verify@cuteteachy.local'),
    );
    expect(emailMsg).toBeDefined();
    expect(emailMsg.Subject).toContain('Mã xác minh email');

    // Extract 6-digit code
    const codeMatch = emailMsg.Subject.match(/\b\d{6}\b/) || emailMsg.Snippet.match(/\b\d{6}\b/);
    expect(codeMatch).not.toBeNull();
    const code = codeMatch![0];

    // 3. Verify email with code
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/email/verify')
      .send({
        email: 'teacher.verify@cuteteachy.local',
        code,
      })
      .expect(200);

    expect(verifyRes.body.user.emailVerified).toBe(true);
    expect(verifyRes.body).toHaveProperty('accessToken');
    expect(verifyRes.body).toHaveProperty('refreshToken');

    // Verify DB reflects verified state
    const account = await prisma.account.findUnique({
      where: { email: 'teacher.verify@cuteteachy.local' },
    });
    expect(account?.emailVerifiedAt).not.toBeNull();

    // Verification code in DB is marked used
    const codeRecord = await prisma.verificationCode.findFirst({
      where: { email: 'teacher.verify@cuteteachy.local', purpose: 'email_verification' },
    });
    expect(codeRecord?.usedAt).not.toBeNull();
  });

  it('POST /auth/email/verify returns 400 invalid_code for wrong code and tracks attempts', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'teacher.attempts@cuteteachy.local',
        password: 'password123',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/email/verify')
      .send({
        email: 'teacher.attempts@cuteteachy.local',
        code: '000000',
      })
      .expect(400);

    expect(res.body.code).toBe('invalid_code');

    const codeRecord = await prisma.verificationCode.findFirst({
      where: { email: 'teacher.attempts@cuteteachy.local', purpose: 'email_verification' },
    });
    expect(codeRecord?.attempts).toBe(1);
  });

  it('POST /auth/email/resend enforces 60s cooldown and delivers new code upon cooldown expiry', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'teacher.resend@cuteteachy.local',
        password: 'password123',
      })
      .expect(201);

    // Immediate resend fails with 429 rate_limited due to cooldown (< 60s)
    const tooSoonRes = await request(app.getHttpServer())
      .post('/auth/email/resend')
      .send({ email: 'teacher.resend@cuteteachy.local' })
      .expect(429);

    expect(tooSoonRes.body.code).toBe('rate_limited');

    // Fast-forward cooldown by updating createdAt in DB to 70s ago
    const pastDate = new Date(Date.now() - 70000);
    await prisma.verificationCode.updateMany({
      where: { email: 'teacher.resend@cuteteachy.local' },
      data: { createdAt: pastDate },
    });

    await clearMailpit();

    // Now resend succeeds with 204 No Content
    await request(app.getHttpServer())
      .post('/auth/email/resend')
      .set('Accept-Language', 'en-US,en;q=0.9')
      .send({ email: 'teacher.resend@cuteteachy.local' })
      .expect(204);

    // New code in Mailpit
    const messages = await getMailpitMessages();
    expect(messages.length).toBe(1);
    expect(messages[0].Subject).toContain('verification code');

    const codeMatch = messages[0].Subject.match(/\b\d{6}\b/) || messages[0].Snippet.match(/\b\d{6}\b/);
    const newCode = codeMatch![0];

    // Verifying with new code succeeds
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/email/verify')
      .send({
        email: 'teacher.resend@cuteteachy.local',
        code: newCode,
      })
      .expect(200);

    expect(verifyRes.body.user.emailVerified).toBe(true);
  });
});

describe('EMAIL_VERIFICATION_REQUIRED=true Login Guard E2E', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(APP_CONFIG)
      .useFactory({
        factory: () => {
          const cfg = (jest.requireActual('../../src/infrastructure/config/app.config') as any).loadConfig();
          return {
            ...cfg,
            EMAIL_VERIFICATION_REQUIRED: true,
          };
        },
      })
      .compile();

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
    if (app) {
      await app.close();
    }
  });

  it('rejects unverified password accounts with 403 email_not_verified when EMAIL_VERIFICATION_REQUIRED=true', async () => {
    // 1. Register
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'strict.teacher@cuteteachy.local',
        password: 'password123',
      })
      .expect(201);

    // 2. Attempt login before verification
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'strict.teacher@cuteteachy.local',
        password: 'password123',
      })
      .expect(403);

    expect(loginRes.body.code).toBe('email_not_verified');

    // 3. Verify email
    const messages = await getMailpitMessages();
    const code = (messages[0].Subject.match(/\b\d{6}\b/) || messages[0].Snippet.match(/\b\d{6}\b/))![0];

    await request(app.getHttpServer())
      .post('/auth/email/verify')
      .send({
        email: 'strict.teacher@cuteteachy.local',
        code,
      })
      .expect(200);

    // 4. Now login succeeds
    const successLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'strict.teacher@cuteteachy.local',
        password: 'password123',
      })
      .expect(200);

    expect(successLoginRes.body.user.emailVerified).toBe(true);
  });
});
