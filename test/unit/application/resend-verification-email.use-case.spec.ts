import { ResendVerificationEmailUseCase } from '../../../src/application/email-verification/resend-verification-email.use-case';
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
import { RateLimitedError } from '../../../src/domain/account/account.errors';

describe('ResendVerificationEmailUseCase', () => {
  let accountRepo: InMemoryAccountRepository;
  let verificationCodeRepo: InMemoryVerificationCodeRepository;
  let rateLimiter: FakeRateLimiter;
  let mailer: FakeMailer;
  let codeGenerator: FakeCodeGenerator;
  let codeHasher: Sha256CodeHasher;
  let idGenerator: SequentialIdGenerator;
  let clock: FixedClock;
  let useCase: ResendVerificationEmailUseCase;
  let testAccount: Account;

  beforeEach(async () => {
    accountRepo = new InMemoryAccountRepository();
    verificationCodeRepo = new InMemoryVerificationCodeRepository();
    rateLimiter = new FakeRateLimiter();
    mailer = new FakeMailer();
    codeGenerator = new FakeCodeGenerator('654321');
    codeHasher = new Sha256CodeHasher();
    idGenerator = new SequentialIdGenerator('id');
    clock = new FixedClock(new Date('2026-10-25T10:00:00.000Z'));

    testAccount = Account.registerWithPassword({
      id: 'acc-1',
      email: Email.create('teacher@cute.com'),
      profileId: 'prof-1',
      now: clock.now(),
    });
    await accountRepo.createWithPassword(testAccount, 'hashed_password');

    useCase = new ResendVerificationEmailUseCase(
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

  it('generates a new code and sends email when cooldown >= 60s', async () => {
    // Previous code created at 09:58 (2 minutes ago > 60s)
    await verificationCodeRepo.create({
      id: 'vc-old',
      email: 'teacher@cute.com',
      accountId: 'acc-1',
      purpose: 'email_verification',
      codeHash: codeHasher.hash('111111'),
      expiresAt: new Date('2026-10-25T10:08:00.000Z'),
      now: new Date('2026-10-25T09:58:00.000Z'),
    });

    await useCase.execute({
      email: 'teacher@cute.com',
      ip: '127.0.0.1',
      acceptLanguage: 'en-US',
    });

    expect(mailer.sentEmails).toHaveLength(1);
    expect(mailer.sentEmails[0].to).toBe('teacher@cute.com');
    expect(mailer.sentEmails[0].subject).toContain('654321');

    const latest = await verificationCodeRepo.findLatest('teacher@cute.com', 'email_verification');
    expect(latest?.codeHash).toBe(codeHasher.hash('654321'));
  });

  it('throws RateLimitedError when cooldown < 60s', async () => {
    // Code created 25s ago
    const recentRecord = {
      id: 'vc-recent',
      email: 'teacher@cute.com',
      accountId: 'acc-1',
      purpose: 'email_verification',
      codeHash: codeHasher.hash('111111'),
      attempts: 0,
      maxAttempts: 5,
      usedAt: null,
      expiresAt: new Date('2026-10-25T10:10:00.000Z'),
      createdAt: new Date('2026-10-25T09:59:35.000Z'), // 25s ago
      updatedAt: new Date('2026-10-25T09:59:35.000Z'),
    };
    verificationCodeRepo.addManualRecord(recentRecord);

    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(RateLimitedError);

    expect(mailer.sentEmails).toHaveLength(0);
  });

  it('throws RateLimitedError when IP rate limit is exceeded', async () => {
    rateLimiter.blockKey('resend-email:127.0.0.1');

    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(RateLimitedError);
  });

  it('returns gracefully without sending email when account does not exist or is already verified', async () => {
    // Non-existent email
    await useCase.execute({
      email: 'nonexistent@cute.com',
      ip: '127.0.0.1',
    });
    expect(mailer.sentEmails).toHaveLength(0);

    // Already verified
    testAccount.verifyEmail(clock.now());
    await accountRepo.markEmailVerified(testAccount.id, clock.now());

    await useCase.execute({
      email: 'teacher@cute.com',
      ip: '127.0.0.1',
    });
    expect(mailer.sentEmails).toHaveLength(0);
  });
});
