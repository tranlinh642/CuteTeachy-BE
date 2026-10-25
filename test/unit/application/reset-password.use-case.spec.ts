import { ResetPasswordUseCase } from '../../../src/application/password-reset/reset-password.use-case';
import { InMemoryAccountRepository } from '../../fakes/in-memory-account.repository';
import { InMemoryRefreshTokenRepository } from '../../fakes/in-memory-refresh-token.repository';
import { InMemoryVerificationCodeRepository } from '../../fakes/in-memory-verification-code.repository';
import { FakePasswordHasher } from '../../fakes/fake-password-hasher';
import { FakeRateLimiter } from '../../fakes/fake-rate-limiter';
import { FixedClock } from '../../fakes/fixed-clock';
import { Sha256CodeHasher } from '../../../src/infrastructure/google-auth/sha256-code-hasher';
import { Account } from '../../../src/domain/account/account.entity';
import { Email } from '../../../src/domain/account/email.vo';
import {
  AccountValidationError,
  InvalidCodeError,
  RateLimitedError,
} from '../../../src/domain/account/account.errors';

describe('ResetPasswordUseCase', () => {
  let accountRepo: InMemoryAccountRepository;
  let refreshTokenRepo: InMemoryRefreshTokenRepository;
  let verificationCodeRepo: InMemoryVerificationCodeRepository;
  let passwordHasher: FakePasswordHasher;
  let rateLimiter: FakeRateLimiter;
  let codeHasher: Sha256CodeHasher;
  let clock: FixedClock;
  let useCase: ResetPasswordUseCase;
  let testAccount: Account;

  beforeEach(async () => {
    accountRepo = new InMemoryAccountRepository();
    refreshTokenRepo = new InMemoryRefreshTokenRepository();
    verificationCodeRepo = new InMemoryVerificationCodeRepository();
    passwordHasher = new FakePasswordHasher();
    rateLimiter = new FakeRateLimiter();
    codeHasher = new Sha256CodeHasher();
    clock = new FixedClock(new Date('2026-10-25T10:00:00.000Z'));

    testAccount = Account.registerWithPassword({
      id: 'acc-1',
      email: Email.create('teacher@cute.com'),
      profileId: 'prof-1',
      now: clock.now(),
    });
    await accountRepo.createWithPassword(testAccount, 'old_hashed_password');

    // Seed active refresh token
    await refreshTokenRepo.save({
      id: 'rt-1',
      accountId: 'acc-1',
      tokenHash: 'token_hash_1',
      familyId: 'fam-1',
      expiresAt: new Date('2026-11-25T10:00:00.000Z'),
    });

    useCase = new ResetPasswordUseCase(
      accountRepo,
      verificationCodeRepo,
      refreshTokenRepo,
      passwordHasher,
      rateLimiter,
      codeHasher,
      clock,
    );
  });

  it('resets password, updates hash, revokes all refresh tokens, and marks code as used', async () => {
    await verificationCodeRepo.create({
      id: 'vc-1',
      email: 'teacher@cute.com',
      accountId: 'acc-1',
      purpose: 'password_reset',
      codeHash: codeHasher.hash('123456'),
      expiresAt: new Date('2026-10-25T10:10:00.000Z'),
      maxAttempts: 5,
    });

    await useCase.execute({
      email: 'teacher@cute.com',
      code: '123456',
      newPassword: 'newStrongPassword8',
      ip: '127.0.0.1',
    });

    // Verify password updated
    const newHash = await accountRepo.getPasswordHash('acc-1');
    expect(newHash).toBe('hashed_newStrongPassword8');

    // Verify all refresh tokens revoked
    const token = await refreshTokenRepo.findByTokenHash('token_hash_1');
    expect(token?.revokedAt).toEqual(clock.now());

    // Verify code marked used
    const code = await verificationCodeRepo.findLatest('teacher@cute.com', 'password_reset');
    expect(code?.usedAt).toEqual(clock.now());
  });

  it('rejects password shorter than 8 chars with AccountValidationError', async () => {
    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        code: '123456',
        newPassword: 'short',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(AccountValidationError);
  });

  it('rejects with InvalidCodeError on wrong code and increments attempts', async () => {
    await verificationCodeRepo.create({
      id: 'vc-1',
      email: 'teacher@cute.com',
      accountId: 'acc-1',
      purpose: 'password_reset',
      codeHash: codeHasher.hash('123456'),
      expiresAt: new Date('2026-10-25T10:10:00.000Z'),
      maxAttempts: 5,
    });

    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        code: '000000',
        newPassword: 'newPassword123',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(InvalidCodeError);

    const code = await verificationCodeRepo.findLatest('teacher@cute.com', 'password_reset');
    expect(code?.attempts).toBe(1);
  });

  it('rejects with InvalidCodeError when max attempts (5) exceeded', async () => {
    const codeRecord = await verificationCodeRepo.create({
      id: 'vc-1',
      email: 'teacher@cute.com',
      accountId: 'acc-1',
      purpose: 'password_reset',
      codeHash: codeHasher.hash('123456'),
      expiresAt: new Date('2026-10-25T10:10:00.000Z'),
      maxAttempts: 5,
    });
    for (let i = 0; i < 5; i++) {
      await verificationCodeRepo.incrementAttempts(codeRecord.id);
    }

    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        code: '123456',
        newPassword: 'newPassword123',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(InvalidCodeError);
  });

  it('rejects with InvalidCodeError when code is expired', async () => {
    await verificationCodeRepo.create({
      id: 'vc-1',
      email: 'teacher@cute.com',
      accountId: 'acc-1',
      purpose: 'password_reset',
      codeHash: codeHasher.hash('123456'),
      expiresAt: new Date('2026-10-25T09:59:00.000Z'),
      maxAttempts: 5,
    });

    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        code: '123456',
        newPassword: 'newPassword123',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(InvalidCodeError);
  });

  it('throws RateLimitedError when rate limit is exceeded', async () => {
    rateLimiter.blockKey('reset-password:127.0.0.1');

    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        code: '123456',
        newPassword: 'newPassword123',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(RateLimitedError);
  });
});
