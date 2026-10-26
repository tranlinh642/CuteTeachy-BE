import { RegisterUseCase } from '../../../src/application/account/register.use-case';
import { InMemoryAccountRepository } from '../../fakes/in-memory-account.repository';
import { InMemoryRefreshTokenRepository } from '../../fakes/in-memory-refresh-token.repository';
import { InMemoryVerificationCodeRepository } from '../../fakes/in-memory-verification-code.repository';
import { FakePasswordHasher } from '../../fakes/fake-password-hasher';
import { FakeTokenService } from '../../fakes/fake-token.service';
import { FakeRateLimiter } from '../../fakes/fake-rate-limiter';
import { FakeMailer } from '../../fakes/fake-mailer';
import { FakeCodeGenerator } from '../../fakes/fake-code-generator';
import { InMemorySettingsRepository } from '../../fakes/in-memory-settings.repository';
import { SequentialIdGenerator } from '../../fakes/sequential-id-generator';
import { FixedClock } from '../../fakes/fixed-clock';
import { Sha256CodeHasher } from '../../../src/infrastructure/google-auth/sha256-code-hasher';
import {
  AccountValidationError,
  EmailTakenError,
  RateLimitedError,
} from '../../../src/domain/account/account.errors';

describe('RegisterUseCase', () => {
  let accountRepo: InMemoryAccountRepository;
  let refreshTokenRepo: InMemoryRefreshTokenRepository;
  let verificationCodeRepo: InMemoryVerificationCodeRepository;
  let passwordHasher: FakePasswordHasher;
  let tokenService: FakeTokenService;
  let rateLimiter: FakeRateLimiter;
  let mailer: FakeMailer;
  let codeGenerator: FakeCodeGenerator;
  let codeHasher: Sha256CodeHasher;
  let idGenerator: SequentialIdGenerator;
  let clock: FixedClock;
  let settingsRepo: InMemorySettingsRepository;
  let useCase: RegisterUseCase;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    refreshTokenRepo = new InMemoryRefreshTokenRepository();
    verificationCodeRepo = new InMemoryVerificationCodeRepository();
    passwordHasher = new FakePasswordHasher();
    tokenService = new FakeTokenService();
    rateLimiter = new FakeRateLimiter();
    mailer = new FakeMailer();
    codeGenerator = new FakeCodeGenerator('654321');
    codeHasher = new Sha256CodeHasher();
    idGenerator = new SequentialIdGenerator('id');
    clock = new FixedClock(new Date('2026-10-25T10:00:00.000Z'));
    settingsRepo = new InMemorySettingsRepository();

    useCase = new RegisterUseCase(
      accountRepo,
      refreshTokenRepo,
      passwordHasher,
      tokenService,
      rateLimiter,
      idGenerator,
      clock,
      verificationCodeRepo,
      codeHasher,
      mailer,
      codeGenerator,
      10,
      60,
      settingsRepo,
    );
  });

  it('successfully registers an account, creates verification code, and sends email', async () => {
    const session = await useCase.execute({
      email: '  Teacher@Cute.Com ',
      password: 'password123',
      remember: true,
      ip: '127.0.0.1',
      acceptLanguage: 'en-US,en;q=0.9',
    });

    expect(session.user.email).toBe('teacher@cute.com');
    expect(session.user.emailVerified).toBe(false);
    expect(session.user.loginProviders).toEqual(['password']);
    expect(session.user.fullName).toBe('');
    expect(session.user.displayName).toBe('');
    expect(session.user.gender).toBeNull();
    expect(session.user.onboardingCompletedAt).toBeNull();
    expect(session.accessToken).toBeDefined();
    expect(session.refreshToken).toBeDefined();

    const saved = await accountRepo.findByEmail('teacher@cute.com');
    expect(saved).not.toBeNull();
    expect(saved?.email).toBe('teacher@cute.com');

    const hash = await accountRepo.getPasswordHash(saved!.id);
    expect(hash).toBe('hashed_password123');

    const tokens = refreshTokenRepo.getAllTokens();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].accountId).toBe(saved!.id);

    // Verification code created
    const codeRecord = await verificationCodeRepo.findLatest('teacher@cute.com', 'email_verification');
    expect(codeRecord).not.toBeNull();
    expect(codeRecord?.codeHash).toBe(codeHasher.hash('654321'));
    expect(codeRecord?.accountId).toBe(saved!.id);
    expect(codeRecord?.expiresAt).toEqual(new Date('2026-10-25T10:10:00.000Z')); // 10m TTL
    expect(codeRecord?.maxAttempts).toBe(5);

    // Email sent
    expect(mailer.sentEmails).toHaveLength(1);
    expect(mailer.sentEmails[0].to).toBe('teacher@cute.com');
    expect(mailer.sentEmails[0].subject).toContain('654321');
    expect(mailer.sentEmails[0].html).toContain('654321');

    // Default settings created according to Accept-Language (en)
    const settings = await settingsRepo.findByAccountId(saved!.id);
    expect(settings).not.toBeNull();
    expect(settings?.locale).toBe('en');
    expect(settings?.timeZone).toBe('Asia/Ho_Chi_Minh');
    expect(settings?.pushEnabled).toBe(true);
    expect(settings?.reminderLeadMinutes).toBe(15);
  });

  it('sends email in Vietnamese when Accept-Language is not English', async () => {
    await useCase.execute({
      email: 'vietnamese@cute.com',
      password: 'password123',
      ip: '127.0.0.1',
      acceptLanguage: 'vi-VN,vi;q=0.9',
    });

    expect(mailer.sentEmails).toHaveLength(1);
    expect(mailer.sentEmails[0].subject).toContain('Mã xác minh email của bạn');

    const vnSaved = await accountRepo.findByEmail('vietnamese@cute.com');
    const vnSettings = await settingsRepo.findByAccountId(vnSaved!.id);
    expect(vnSettings?.locale).toBe('vi');
    expect(vnSettings?.timeZone).toBe('Asia/Ho_Chi_Minh');
    expect(vnSettings?.pushEnabled).toBe(true);
    expect(vnSettings?.reminderLeadMinutes).toBe(15);
  });

  it('rejects duplicate email with EmailTakenError (email_taken) without sending email', async () => {
    await useCase.execute({
      email: 'teacher@cute.com',
      password: 'password123',
      ip: '127.0.0.1',
    });
    mailer.clear();

    await expect(
      useCase.execute({
        email: 'TEACHER@cute.com',
        password: 'anotherPassword8',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(EmailTakenError);

    expect(mailer.sentEmails).toHaveLength(0);
  });

  it('validates email format and password length', async () => {
    await expect(
      useCase.execute({
        email: 'invalid-email',
        password: 'password123',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(AccountValidationError);

    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        password: 'short',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(AccountValidationError);
  });

  it('throws RateLimitedError when rate limit is exceeded', async () => {
    rateLimiter.blockKey('register:127.0.0.1');

    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        password: 'password123',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(RateLimitedError);
  });
});
