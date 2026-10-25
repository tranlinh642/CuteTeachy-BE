import { RegisterUseCase } from '../../../src/application/account/register.use-case';
import { InMemoryAccountRepository } from '../../fakes/in-memory-account.repository';
import { InMemoryRefreshTokenRepository } from '../../fakes/in-memory-refresh-token.repository';
import { FakePasswordHasher } from '../../fakes/fake-password-hasher';
import { FakeTokenService } from '../../fakes/fake-token.service';
import { FakeRateLimiter } from '../../fakes/fake-rate-limiter';
import { SequentialIdGenerator } from '../../fakes/sequential-id-generator';
import { FixedClock } from '../../fakes/fixed-clock';
import {
  AccountValidationError,
  EmailTakenError,
  RateLimitedError,
} from '../../../src/domain/account/account.errors';

describe('RegisterUseCase', () => {
  let accountRepo: InMemoryAccountRepository;
  let refreshTokenRepo: InMemoryRefreshTokenRepository;
  let passwordHasher: FakePasswordHasher;
  let tokenService: FakeTokenService;
  let rateLimiter: FakeRateLimiter;
  let idGenerator: SequentialIdGenerator;
  let clock: FixedClock;
  let useCase: RegisterUseCase;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    refreshTokenRepo = new InMemoryRefreshTokenRepository();
    passwordHasher = new FakePasswordHasher();
    tokenService = new FakeTokenService();
    rateLimiter = new FakeRateLimiter();
    idGenerator = new SequentialIdGenerator('id');
    clock = new FixedClock(new Date('2026-10-25T10:00:00.000Z'));

    useCase = new RegisterUseCase(
      accountRepo,
      refreshTokenRepo,
      passwordHasher,
      tokenService,
      rateLimiter,
      idGenerator,
      clock,
    );
  });

  it('successfully registers an account and returns an auth session', async () => {
    const session = await useCase.execute({
      email: '  Teacher@Cute.Com ',
      password: 'password123',
      remember: true,
      ip: '127.0.0.1',
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
  });

  it('rejects duplicate email with EmailTakenError (email_taken)', async () => {
    await useCase.execute({
      email: 'teacher@cute.com',
      password: 'password123',
      ip: '127.0.0.1',
    });

    await expect(
      useCase.execute({
        email: 'TEACHER@cute.com',
        password: 'anotherPassword8',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(EmailTakenError);
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
