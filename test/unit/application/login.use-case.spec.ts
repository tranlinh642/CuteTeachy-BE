import { LoginUseCase } from '../../../src/application/account/login.use-case';
import { InMemoryAccountRepository } from '../../fakes/in-memory-account.repository';
import { InMemoryRefreshTokenRepository } from '../../fakes/in-memory-refresh-token.repository';
import { FakePasswordHasher } from '../../fakes/fake-password-hasher';
import { FakeTokenService } from '../../fakes/fake-token.service';
import { FakeRateLimiter } from '../../fakes/fake-rate-limiter';
import { SequentialIdGenerator } from '../../fakes/sequential-id-generator';
import { FixedClock } from '../../fakes/fixed-clock';
import { Account } from '../../../src/domain/account/account.entity';
import { Email } from '../../../src/domain/account/email.vo';
import { Profile } from '../../../src/domain/account/profile.entity';
import {
  EmailNotVerifiedError,
  InvalidCredentialsError,
  RateLimitedError,
} from '../../../src/domain/account/account.errors';

describe('LoginUseCase', () => {
  let accountRepo: InMemoryAccountRepository;
  let refreshTokenRepo: InMemoryRefreshTokenRepository;
  let passwordHasher: FakePasswordHasher;
  let tokenService: FakeTokenService;
  let rateLimiter: FakeRateLimiter;
  let idGenerator: SequentialIdGenerator;
  let clock: FixedClock;
  let useCase: LoginUseCase;

  beforeEach(async () => {
    accountRepo = new InMemoryAccountRepository();
    refreshTokenRepo = new InMemoryRefreshTokenRepository();
    passwordHasher = new FakePasswordHasher();
    tokenService = new FakeTokenService();
    rateLimiter = new FakeRateLimiter();
    idGenerator = new SequentialIdGenerator('id');
    clock = new FixedClock(new Date('2026-10-25T10:00:00.000Z'));

    useCase = new LoginUseCase(
      accountRepo,
      refreshTokenRepo,
      passwordHasher,
      tokenService,
      rateLimiter,
      idGenerator,
      clock,
      10,
      60,
      false,
    );

    // Seed an account
    const account = Account.registerWithPassword({
      id: 'acc-1',
      email: Email.create('teacher@cute.com'),
      profileId: 'prof-1',
      now: clock.now(),
    });
    const hash = await passwordHasher.hash('correctPassword123');
    await accountRepo.createWithPassword(account, hash);
  });

  it('successfully logs in with valid email and password when email verification is not required', async () => {
    const session = await useCase.execute({
      email: ' TEACHER@cute.com ',
      password: 'correctPassword123',
      remember: false,
      ip: '127.0.0.1',
    });

    expect(session.user.id).toBe('acc-1');
    expect(session.user.email).toBe('teacher@cute.com');
    expect(session.accessToken).toBeDefined();
    expect(session.refreshToken).toBeDefined();
  });

  it('throws EmailNotVerifiedError (403 email_not_verified) when emailVerificationRequired=true and emailVerifiedAt=null', async () => {
    const strictUseCase = new LoginUseCase(
      accountRepo,
      refreshTokenRepo,
      passwordHasher,
      tokenService,
      rateLimiter,
      idGenerator,
      clock,
      10,
      60,
      true, // EMAIL_VERIFICATION_REQUIRED
    );

    await expect(
      strictUseCase.execute({
        email: 'teacher@cute.com',
        password: 'correctPassword123',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(EmailNotVerifiedError);
  });

  it('allows login when emailVerificationRequired=true and emailVerifiedAt is set', async () => {
    const strictUseCase = new LoginUseCase(
      accountRepo,
      refreshTokenRepo,
      passwordHasher,
      tokenService,
      rateLimiter,
      idGenerator,
      clock,
      10,
      60,
      true, // EMAIL_VERIFICATION_REQUIRED
    );

    await accountRepo.markEmailVerified('acc-1', clock.now());

    const session = await strictUseCase.execute({
      email: 'teacher@cute.com',
      password: 'correctPassword123',
      ip: '127.0.0.1',
    });

    expect(session.user.emailVerified).toBe(true);
  });

  it('throws InvalidCredentialsError before checking verification when password is wrong even if verification is required', async () => {
    const strictUseCase = new LoginUseCase(
      accountRepo,
      refreshTokenRepo,
      passwordHasher,
      tokenService,
      rateLimiter,
      idGenerator,
      clock,
      10,
      60,
      true,
    );

    await expect(
      strictUseCase.execute({
        email: 'teacher@cute.com',
        password: 'wrongPassword',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('rejects with InvalidCredentialsError when password does not match', async () => {
    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        password: 'wrongPassword123',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('rejects with InvalidCredentialsError when email does not exist', async () => {
    await expect(
      useCase.execute({
        email: 'nonexistent@cute.com',
        password: 'correctPassword123',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('rejects with InvalidCredentialsError when account only has google provider', async () => {
    const googleAccount = Account.reconstitute({
      id: 'acc-google',
      email: 'google.user@example.com',
      emailVerifiedAt: new Date(),
      loginProviders: ['google'],
      profile: Profile.createEmpty('acc-google', 'prof-g'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // Store in repo without password
    await (accountRepo as any).accounts.set('acc-google', googleAccount);

    await expect(
      useCase.execute({
        email: 'google.user@example.com',
        password: 'anyPassword123',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('rejects with RateLimitedError when rate limit is exceeded', async () => {
    rateLimiter.blockKey('login:127.0.0.1');

    await expect(
      useCase.execute({
        email: 'teacher@cute.com',
        password: 'correctPassword123',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(RateLimitedError);
  });
});
