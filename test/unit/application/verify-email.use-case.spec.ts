import { VerifyEmailUseCase } from '../../../src/application/email-verification/verify-email.use-case';
import { InMemoryAccountRepository } from '../../fakes/in-memory-account.repository';
import { InMemoryRefreshTokenRepository } from '../../fakes/in-memory-refresh-token.repository';
import { InMemoryVerificationCodeRepository } from '../../fakes/in-memory-verification-code.repository';
import { FakeTokenService } from '../../fakes/fake-token.service';
import { FakeRateLimiter } from '../../fakes/fake-rate-limiter';
import { SequentialIdGenerator } from '../../fakes/sequential-id-generator';
import { FixedClock } from '../../fakes/fixed-clock';
import { Sha256CodeHasher } from '../../../src/infrastructure/google-auth/sha256-code-hasher';
import { Account } from '../../../src/domain/account/account.entity';
import { Email } from '../../../src/domain/account/email.vo';
import { InvalidCodeError, RateLimitedError } from '../../../src/domain/account/account.errors';

describe('VerifyEmailUseCase', () => {
  let accountRepo: InMemoryAccountRepository;
  let refreshTokenRepo: InMemoryRefreshTokenRepository;
  let verificationCodeRepo: InMemoryVerificationCodeRepository;
  let tokenService: FakeTokenService;
  let rateLimiter: FakeRateLimiter;
  let codeHasher: Sha256CodeHasher;
  let idGenerator: SequentialIdGenerator;
  let clock: FixedClock;
  let useCase: VerifyEmailUseCase;
  let testAccount: Account;

  beforeEach(async () => {
    accountRepo = new InMemoryAccountRepository();
    refreshTokenRepo = new InMemoryRefreshTokenRepository();
    verificationCodeRepo = new InMemoryVerificationCodeRepository();
    tokenService = new FakeTokenService();
    rateLimiter = new FakeRateLimiter();
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

    useCase = new VerifyEmailUseCase(
      accountRepo,
      verificationCodeRepo,
      refreshTokenRepo,
      tokenService,
      rateLimiter,
      codeHasher,
      idGenerator,
      clock,
    );
  });

  it('successfully verifies email with correct code, updates emailVerifiedAt, and returns session', async () => {
    // Seed verification code
    await verificationCodeRepo.create({
      id: 'vc-1',
      email: 'teacher@cute.com',
      accountId: 'acc-1',
      purpose: 'email_verification',
      codeHash: codeHasher.hash('123456'),
      expiresAt: new Date('2026-10-25T10:10:00.000Z'),
      maxAttempts: 5,
    });

    const session = await useCase.execute({
      email: 'teacher@cute.com',
      code: '123456',
      ip: '127.0.0.1',
    });

    expect(session.user.emailVerified).toBe(true);
    expect(session.accessToken).toBeDefined();
    expect(session.refreshToken).toBeDefined();

    // Check account in repo
    const updated = await accountRepo.findByEmail('teacher@cute.com');
    expect(updated?.emailVerifiedAt).toEqual(clock.now());

    // Check code marked used
    const code = await verificationCodeRepo.findLatest('teacher@cute.com', 'email_verification');
    expect(code?.usedAt).toEqual(clock.now());
  });

  it('throws InvalidCodeError and increments attempts on wrong code', async () => {
    await verificationCodeRepo.create({
      id: 'vc-1',
      email: 'teacher@cute.com',
      accountId: 'acc-1',
      purpose: 'email_verification',
      codeHash: codeHasher.hash('123456'),
      expiresAt: new Date('2026-10-25T10:10:00.000Z'),
      maxAttempts: 5,
    });

    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        code: '999999',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(InvalidCodeError);

    const code = await verificationCodeRepo.findLatest('teacher@cute.com', 'email_verification');
    expect(code?.attempts).toBe(1);
  });

  it('throws InvalidCodeError when max attempts reached', async () => {
    const codeRecord = await verificationCodeRepo.create({
      id: 'vc-1',
      email: 'teacher@cute.com',
      accountId: 'acc-1',
      purpose: 'email_verification',
      codeHash: codeHasher.hash('123456'),
      expiresAt: new Date('2026-10-25T10:10:00.000Z'),
      maxAttempts: 5,
    });
    // Set 5 attempts
    for (let i = 0; i < 5; i++) {
      await verificationCodeRepo.incrementAttempts(codeRecord.id);
    }

    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        code: '123456',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(InvalidCodeError);
  });

  it('throws InvalidCodeError when code is expired', async () => {
    // Expired at 09:59
    await verificationCodeRepo.create({
      id: 'vc-1',
      email: 'teacher@cute.com',
      accountId: 'acc-1',
      purpose: 'email_verification',
      codeHash: codeHasher.hash('123456'),
      expiresAt: new Date('2026-10-25T09:59:00.000Z'),
      maxAttempts: 5,
    });

    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        code: '123456',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(InvalidCodeError);
  });

  it('throws InvalidCodeError when code was already used', async () => {
    const codeRecord = await verificationCodeRepo.create({
      id: 'vc-1',
      email: 'teacher@cute.com',
      accountId: 'acc-1',
      purpose: 'email_verification',
      codeHash: codeHasher.hash('123456'),
      expiresAt: new Date('2026-10-25T10:10:00.000Z'),
      maxAttempts: 5,
    });
    await verificationCodeRepo.markUsed(codeRecord.id, new Date('2026-10-25T10:01:00.000Z'));

    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        code: '123456',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(InvalidCodeError);
  });

  it('throws RateLimitedError when rate limit exceeded', async () => {
    rateLimiter.blockKey('verify-email:127.0.0.1');

    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        code: '123456',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(RateLimitedError);
  });
});
