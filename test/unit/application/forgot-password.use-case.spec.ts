import { ForgotPasswordUseCase } from '../../../src/application/password-reset/forgot-password.use-case';
import { InMemoryAccountRepository } from '../../fakes/in-memory-account.repository';
import { InMemoryVerificationCodeRepository } from '../../fakes/in-memory-verification-code.repository';
import { FakeRateLimiter } from '../../fakes/fake-rate-limiter';
import { FakeMailer } from '../../fakes/fake-mailer';
import { FakeCodeGenerator } from '../../fakes/fake-code-generator';
import { SequentialIdGenerator } from '../../fakes/sequential-id-generator';
import { FixedClock } from '../../fakes/fixed-clock';
import { Sha256CodeHasher } from '../../../src/infrastructure/google-auth/sha256-code-hasher';
import { Account } from '../../../src/domain/account/account.entity';
import { Email } from '../../../src/domain/account/email.vo';
import { Profile } from '../../../src/domain/account/profile.entity';
import { RateLimitedError } from '../../../src/domain/account/account.errors';

describe('ForgotPasswordUseCase', () => {
  let accountRepo: InMemoryAccountRepository;
  let verificationCodeRepo: InMemoryVerificationCodeRepository;
  let rateLimiter: FakeRateLimiter;
  let mailer: FakeMailer;
  let codeGenerator: FakeCodeGenerator;
  let codeHasher: Sha256CodeHasher;
  let idGenerator: SequentialIdGenerator;
  let clock: FixedClock;
  let useCase: ForgotPasswordUseCase;

  beforeEach(async () => {
    accountRepo = new InMemoryAccountRepository();
    verificationCodeRepo = new InMemoryVerificationCodeRepository();
    rateLimiter = new FakeRateLimiter();
    mailer = new FakeMailer();
    codeGenerator = new FakeCodeGenerator('987654');
    codeHasher = new Sha256CodeHasher();
    idGenerator = new SequentialIdGenerator('id');
    clock = new FixedClock(new Date('2026-10-25T10:00:00.000Z'));

    const account = Account.registerWithPassword({
      id: 'acc-1',
      email: Email.create('teacher@cute.com'),
      profileId: 'prof-1',
      now: clock.now(),
    });
    await accountRepo.createWithPassword(account, 'hashed_password');

    useCase = new ForgotPasswordUseCase(
      accountRepo,
      verificationCodeRepo,
      mailer,
      codeHasher,
      rateLimiter,
      idGenerator,
      clock,
      codeGenerator,
    );
  });

  it('generates a password_reset code and sends email when account exists with password provider', async () => {
    await useCase.execute({
      email: 'TEACHER@cute.com',
      ip: '127.0.0.1',
      acceptLanguage: 'en-US',
    });

    expect(mailer.sentEmails).toHaveLength(1);
    expect(mailer.sentEmails[0].to).toBe('teacher@cute.com');
    expect(mailer.sentEmails[0].subject).toContain('987654');

    const codeRecord = await verificationCodeRepo.findLatest('teacher@cute.com', 'password_reset');
    expect(codeRecord).not.toBeNull();
    expect(codeRecord?.codeHash).toBe(codeHasher.hash('987654'));
    expect(codeRecord?.purpose).toBe('password_reset');
  });

  it('returns timing-safe 204 without sending email when account does not exist', async () => {
    await useCase.execute({
      email: 'nonexistent@cute.com',
      ip: '127.0.0.1',
    });

    expect(mailer.sentEmails).toHaveLength(0);
    const codeRecord = await verificationCodeRepo.findLatest('nonexistent@cute.com', 'password_reset');
    expect(codeRecord).toBeNull();
  });

  it('returns timing-safe 204 without sending email when account only has google provider', async () => {
    const googleAccount = Account.reconstitute({
      id: 'acc-google',
      email: 'google@cute.com',
      emailVerifiedAt: new Date(),
      loginProviders: ['google'],
      profile: Profile.createEmpty('acc-google', 'prof-g'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (accountRepo as any).accounts.set('acc-google', googleAccount);

    await useCase.execute({
      email: 'google@cute.com',
      ip: '127.0.0.1',
    });

    expect(mailer.sentEmails).toHaveLength(0);
  });

  it('throws RateLimitedError when IP rate limit is exceeded', async () => {
    rateLimiter.blockKey('forgot-password:127.0.0.1');

    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(RateLimitedError);
  });
});
