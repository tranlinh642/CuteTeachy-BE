import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';
import {
  GOOGLE_OAUTH_CLIENT,
  GoogleOAuthClient,
  GoogleUserInfo,
} from '../../src/application/google-auth/ports/google-oauth.client.port';

describe('Google OAuth & Account Linking E2E', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let fakeGoogleClient: GoogleOAuthClient;

  beforeAll(async () => {
    fakeGoogleClient = {
      getAuthorizationUrl: jest.fn().mockImplementation((state: string) => {
        return `https://accounts.google.com/o/oauth2/v2/auth?state=${encodeURIComponent(state)}&client_id=mock-client-id`;
      }),
      getUserInfo: jest.fn().mockImplementation(async (code: string): Promise<GoogleUserInfo> => {
        if (code === 'code_new_user') {
          return {
            sub: 'google_sub_new_user_1',
            email: 'new_teacher@gmail.com',
            emailVerified: true,
            name: 'New Google Teacher',
            givenName: 'New Teacher',
            picture: 'https://lh3.googleusercontent.com/avatar1.jpg',
          };
        }
        if (code === 'code_link_user') {
          return {
            sub: 'google_sub_link_user_2',
            email: 'password_teacher@example.com',
            emailVerified: true,
            name: 'Linked Google Teacher',
            givenName: 'Linked Teacher',
            picture: 'https://lh3.googleusercontent.com/avatar2.jpg',
          };
        }
        if (code === 'code_unverified') {
          return {
            sub: 'google_sub_unverified',
            email: 'unverified@gmail.com',
            emailVerified: false,
          };
        }
        throw new Error('Google OAuth exchange error: invalid_grant');
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GOOGLE_OAUTH_CLIENT)
      .useValue(fakeGoogleClient)
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.rateLimitCounter.deleteMany();
    await prisma.oneTimeExchangeCode.deleteMany();
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

  describe('GET /auth/google', () => {
    it('redirects 302 to Google authorization URL with state containing remember=true', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/google?remember=true')
        .expect(302);

      const location = res.headers.location;
      expect(location).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
      expect(location).toContain('state=');
      expect(fakeGoogleClient.getAuthorizationUrl).toHaveBeenCalled();
    });

    it('redirects 302 to Google authorization URL with remember=false', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/google?remember=false')
        .expect(302);

      const location = res.headers.location;
      expect(location).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
      expect(location).toContain('state=');
    });
  });

  describe('GET /auth/google/callback - Error scenarios', () => {
    it('redirects 302 to FE callback with error=google_failed when state is invalid/tampered', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/google/callback?code=some_code&state=invalid_or_tampered_state')
        .expect(302);

      expect(res.headers.location).toBe('http://localhost:3000/auth/callback?error=google_failed');
    });

    it('redirects 302 to FE callback with error=google_failed when user cancelled (error in query)', async () => {
      // First get a valid state
      const googleInitRes = await request(app.getHttpServer())
        .get('/auth/google?remember=true')
        .expect(302);
      const url = new URL(googleInitRes.headers.location);
      const state = url.searchParams.get('state')!;

      const res = await request(app.getHttpServer())
        .get(`/auth/google/callback?error=access_denied&state=${encodeURIComponent(state)}`)
        .expect(302);

      expect(res.headers.location).toBe('http://localhost:3000/auth/callback?error=google_failed');
    });

    it('redirects 302 to FE callback with error=google_failed when Google email is unverified', async () => {
      const googleInitRes = await request(app.getHttpServer())
        .get('/auth/google?remember=true')
        .expect(302);
      const url = new URL(googleInitRes.headers.location);
      const state = url.searchParams.get('state')!;

      const res = await request(app.getHttpServer())
        .get(`/auth/google/callback?code=code_unverified&state=${encodeURIComponent(state)}`)
        .expect(302);

      expect(res.headers.location).toBe('http://localhost:3000/auth/callback?error=google_failed');
    });
  });

  describe('Full Flow: New Account via Google', () => {
    it('creates new Account with Google info, exchanges code for AuthSession', async () => {
      // Step 1: Initiate Google login with remember=true
      const initRes = await request(app.getHttpServer())
        .get('/auth/google?remember=true')
        .expect(302);
      const initUrl = new URL(initRes.headers.location);
      const state = initUrl.searchParams.get('state')!;
      expect(state).toBeTruthy();

      // Step 2: Callback from Google
      const callbackRes = await request(app.getHttpServer())
        .get(`/auth/google/callback?code=code_new_user&state=${encodeURIComponent(state)}`)
        .expect(302);

      const callbackUrl = new URL(callbackRes.headers.location);
      expect(callbackUrl.origin).toBe('http://localhost:3000');
      expect(callbackUrl.pathname).toBe('/auth/callback');
      const exchangeCode = callbackUrl.searchParams.get('code');
      expect(exchangeCode).toBeTruthy();

      // Step 3: Exchange code for AuthSession
      const exchangeRes = await request(app.getHttpServer())
        .post('/auth/google/exchange')
        .send({ code: exchangeCode })
        .expect(200);

      const session = exchangeRes.body;
      expect(session).toHaveProperty('user');
      expect(session).toHaveProperty('accessToken');
      expect(session).toHaveProperty('expiresAt');
      expect(session).toHaveProperty('refreshToken');
      expect(session).toHaveProperty('refreshExpiresAt');

      // Verify User details
      expect(session.user.email).toBe('new_teacher@gmail.com');
      expect(session.user.emailVerified).toBe(true);
      expect(session.user.loginProviders).toEqual(['google']);
      expect(session.user.fullName).toBe('New Google Teacher');
      expect(session.user.displayName).toBe('New Teacher');
      expect(session.user.avatarUrl).toBe('https://lh3.googleusercontent.com/avatar1.jpg');
      expect(session.user.gender).toBeNull();
      expect(session.user.onboardingCompletedAt).toBeNull();

      // Verify refresh token TTL is 30 days (remember=true)
      const now = Date.now();
      const refreshExpires = new Date(session.refreshExpiresAt).getTime();
      const diffDays = Math.round((refreshExpires - now) / (1000 * 3600 * 24));
      expect(diffDays).toBe(30);

      // Verify DB state
      const accountInDb = await prisma.account.findUnique({
        where: { email: 'new_teacher@gmail.com' },
        include: { loginProviders: true, profile: true },
      });
      expect(accountInDb).not.toBeNull();
      expect(accountInDb?.emailVerifiedAt).not.toBeNull();
      expect(accountInDb?.loginProviders).toHaveLength(1);
      expect(accountInDb?.loginProviders[0].provider).toBe('google');
      expect(accountInDb?.loginProviders[0].subject).toBe('google_sub_new_user_1');
      expect(accountInDb?.profile?.fullName).toBe('New Google Teacher');
      expect(accountInDb?.profile?.displayName).toBe('New Teacher');
      expect(accountInDb?.profile?.avatarUrl).toBe('https://lh3.googleusercontent.com/avatar1.jpg');
    });
  });

  describe('Full Flow: Account Linking with existing password account', () => {
    it('links Google provider to existing account having same email, does not create new account', async () => {
      // Step 1: Create existing account with password
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'password_teacher@example.com',
          password: 'password123',
        })
        .expect(201);
      const existingAccountId = registerRes.body.user.id;

      // Step 2: User initiates Google login with remember=false
      const initRes = await request(app.getHttpServer())
        .get('/auth/google?remember=false')
        .expect(302);
      const initUrl = new URL(initRes.headers.location);
      const state = initUrl.searchParams.get('state')!;

      // Step 3: Callback from Google
      const callbackRes = await request(app.getHttpServer())
        .get(`/auth/google/callback?code=code_link_user&state=${encodeURIComponent(state)}`)
        .expect(302);

      const callbackUrl = new URL(callbackRes.headers.location);
      const exchangeCode = callbackUrl.searchParams.get('code')!;
      expect(exchangeCode).toBeTruthy();

      // Step 4: Exchange code
      const exchangeRes = await request(app.getHttpServer())
        .post('/auth/google/exchange')
        .send({ code: exchangeCode })
        .expect(200);

      const session = exchangeRes.body;
      expect(session.user.id).toBe(existingAccountId);
      expect(session.user.email).toBe('password_teacher@example.com');
      expect(session.user.loginProviders).toContain('password');
      expect(session.user.loginProviders).toContain('google');

      // Verify refresh token TTL is 1 day (remember=false)
      const now = Date.now();
      const refreshExpires = new Date(session.refreshExpiresAt).getTime();
      const diffHours = Math.round((refreshExpires - now) / (1000 * 3600));
      expect(diffHours).toBe(24);

      // Verify in DB only 1 account exists
      const accounts = await prisma.account.findMany({
        where: { email: 'password_teacher@example.com' },
        include: { loginProviders: true },
      });
      expect(accounts).toHaveLength(1);
      expect(accounts[0].loginProviders).toHaveLength(2);
      const providers = accounts[0].loginProviders.map((p) => p.provider);
      expect(providers).toContain('password');
      expect(providers).toContain('google');

      // Subsequent login via Google: should find by subject directly
      const subInitRes = await request(app.getHttpServer())
        .get('/auth/google?remember=true')
        .expect(302);
      const subState = new URL(subInitRes.headers.location).searchParams.get('state')!;

      const subCallbackRes = await request(app.getHttpServer())
        .get(`/auth/google/callback?code=code_link_user&state=${encodeURIComponent(subState)}`)
        .expect(302);
      const subCode = new URL(subCallbackRes.headers.location).searchParams.get('code')!;

      const subExchangeRes = await request(app.getHttpServer())
        .post('/auth/google/exchange')
        .send({ code: subCode })
        .expect(200);

      expect(subExchangeRes.body.user.id).toBe(existingAccountId);
    });
  });

  describe('Single-use violation & Invalid code handling', () => {
    it('returns 401 invalid_code when reusing an exchange code', async () => {
      // Initiate Google login
      const initRes = await request(app.getHttpServer())
        .get('/auth/google?remember=true')
        .expect(302);
      const state = new URL(initRes.headers.location).searchParams.get('state')!;

      const callbackRes = await request(app.getHttpServer())
        .get(`/auth/google/callback?code=code_new_user&state=${encodeURIComponent(state)}`)
        .expect(302);
      const exchangeCode = new URL(callbackRes.headers.location).searchParams.get('code')!;

      // First exchange: succeeds
      await request(app.getHttpServer())
        .post('/auth/google/exchange')
        .send({ code: exchangeCode })
        .expect(200);

      // Second exchange (reuse): MUST FAIL with 401 invalid_code
      const reusedRes = await request(app.getHttpServer())
        .post('/auth/google/exchange')
        .send({ code: exchangeCode })
        .expect(401);

      expect(reusedRes.body.code).toBe('invalid_code');
    });

    it('returns 401 invalid_code for completely invalid or non-existent code', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/google/exchange')
        .send({ code: 'non_existent_random_code_12345' })
        .expect(401);

      expect(res.body.code).toBe('invalid_code');
    });
  });
});
