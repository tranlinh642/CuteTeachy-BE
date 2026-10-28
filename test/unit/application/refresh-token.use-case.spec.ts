import { RefreshTokenUseCase } from '../../../src/application/account/refresh-token.use-case';
import { InMemoryAccountRepository } from '../../fakes/in-memory-account.repository';
import { InMemoryRefreshTokenRepository } from '../../fakes/in-memory-refresh-token.repository';
import { FakeTokenService } from '../../fakes/fake-token.service';
import { FakeRateLimiter } from '../../fakes/fake-rate-limiter';
import { SequentialIdGenerator } from '../../fakes/sequential-id-generator';
import { FixedClock } from '../../fakes/fixed-clock';
import { Account } from '../../../src/domain/account/account.entity';
import { Email } from '../../../src/domain/account/email.vo';
import {
  RateLimitedError,
  UnauthorizedError,
} from '../../../src/domain/account/account.errors';

describe('RefreshTokenUseCase', () => {
  let accountRepo: InMemoryAccountRepository;
  let refreshTokenRepo: InMemoryRefreshTokenRepository;
  let tokenService: FakeTokenService;
  let rateLimiter: FakeRateLimiter;
  let idGenerator: SequentialIdGenerator;
  let clock: FixedClock;
  let useCase: RefreshTokenUseCase;

  const initialDate = new Date('2026-10-25T10:00:00.000Z');

  beforeEach(async () => {
    accountRepo = new InMemoryAccountRepository();
    refreshTokenRepo = new InMemoryRefreshTokenRepository();
    tokenService = new FakeTokenService();
    rateLimiter = new FakeRateLimiter();
    idGenerator = new SequentialIdGenerator('id');
    clock = new FixedClock(initialDate);

    useCase = new RefreshTokenUseCase(
      accountRepo,
      refreshTokenRepo,
      tokenService,
      rateLimiter,
      idGenerator,
      clock,
    );

    // Seed account
    const account = Account.registerWithPassword({
      id: 'acc-1',
      email: Email.create('teacher@cute.com'),
      profileId: 'prof-1',
      now: initialDate,
    });
    await accountRepo.createWithPassword(account, 'hash');
  });

  it('rotates refresh token and returns new session for valid active token', async () => {
    const rawToken = 'valid_token_1';
    const hash = tokenService.hashRefreshToken(rawToken);
    const expiresAt = new Date(initialDate.getTime() + 86400000);

    await refreshTokenRepo.save({
      id: 'tok-1',
      accountId: 'acc-1',
      tokenHash: hash,
      familyId: 'family-1',
      expiresAt,
      createdAt: initialDate,
    });

    const session = await useCase.execute({
      refreshToken: rawToken,
      ip: '127.0.0.1',
    });

    expect(session.user.id).toBe('acc-1');
    expect(session.accessToken).toBeDefined();
    expect(session.refreshToken).toBeDefined();
    expect(session.refreshToken).not.toBe(rawToken);

    // Verify old token is revoked
    const oldRecord = await refreshTokenRepo.findByTokenHash(hash);
    expect(oldRecord?.revokedAt).not.toBeNull();

    // Verify new token exists in repo with same family
    const allTokens = refreshTokenRepo.getAllTokens();
    expect(allTokens).toHaveLength(2);
    const newRecord = allTokens.find((t) => t.id !== 'tok-1');
    expect(newRecord?.familyId).toBe('family-1');
    expect(newRecord?.revokedAt).toBeNull();
  });

  it('preserves 30-day TTL when rotating a remember token (SPEC-01)', async () => {
    const rawToken = 'remember_token_1';
    const hash = tokenService.hashRefreshToken(rawToken);
    const thirtyDaysMs = 30 * 86400000;
    const expiresAt = new Date(initialDate.getTime() + thirtyDaysMs);

    await refreshTokenRepo.save({
      id: 'tok-remember',
      accountId: 'acc-1',
      tokenHash: hash,
      familyId: 'family-remember',
      expiresAt,
      createdAt: initialDate,
    });

    const session = await useCase.execute({
      refreshToken: rawToken,
      ip: '127.0.0.1',
    });

    expect(session.user.id).toBe('acc-1');
    expect(session.refreshToken).toBeDefined();

    const allTokens = refreshTokenRepo.getAllTokens();
    const newRecord = allTokens.find((t) => t.id !== 'tok-remember');
    expect(newRecord).toBeDefined();
    expect(newRecord?.familyId).toBe('family-remember');

    // In FakeTokenService, remember=true produces 30 days TTL (Date.now() + 30 days)
    // Verify that the new token has ~30 days TTL (> 29 days) and NOT downgraded to 1 day
    const newTtlMs = newRecord!.expiresAt.getTime() - Date.now();
    expect(newTtlMs).toBeGreaterThan(29 * 86400000);
  });

  it('preserves 1-day TTL when rotating a non-remember session token', async () => {
    const rawToken = 'session_token_1';
    const hash = tokenService.hashRefreshToken(rawToken);
    const oneDayMs = 86400000;
    const expiresAt = new Date(initialDate.getTime() + oneDayMs);

    await refreshTokenRepo.save({
      id: 'tok-session',
      accountId: 'acc-1',
      tokenHash: hash,
      familyId: 'family-session',
      expiresAt,
      createdAt: initialDate,
    });

    await useCase.execute({
      refreshToken: rawToken,
      ip: '127.0.0.1',
    });

    const allTokens = refreshTokenRepo.getAllTokens();
    const newRecord = allTokens.find((t) => t.id !== 'tok-session');
    expect(newRecord).toBeDefined();

    // Verify that the new token has <= 1 day TTL
    const newTtlMs = newRecord!.expiresAt.getTime() - Date.now();
    expect(newTtlMs).toBeLessThanOrEqual(86400000);
  });

  it('detects reuse of revoked token and revokes ALL tokens of the account', async () => {
    const rawToken1 = 'token_revoked_1';
    const hash1 = tokenService.hashRefreshToken(rawToken1);

    const rawToken2 = 'token_active_2';
    const hash2 = tokenService.hashRefreshToken(rawToken2);

    // Save token 1 as revoked
    await refreshTokenRepo.save({
      id: 'tok-1',
      accountId: 'acc-1',
      tokenHash: hash1,
      familyId: 'family-1',
      expiresAt: new Date(initialDate.getTime() + 86400000),
      createdAt: initialDate,
    });
    await refreshTokenRepo.revoke('tok-1', initialDate);

    // Save token 2 as active
    await refreshTokenRepo.save({
      id: 'tok-2',
      accountId: 'acc-1',
      tokenHash: hash2,
      familyId: 'family-1',
      expiresAt: new Date(initialDate.getTime() + 86400000),
      createdAt: initialDate,
    });

    // Attempt to reuse revoked token 1
    await expect(
      useCase.execute({
        refreshToken: rawToken1,
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(UnauthorizedError);

    // Now token 2 must ALSO be revoked!
    const token2 = await refreshTokenRepo.findByTokenHash(hash2);
    expect(token2?.revokedAt).not.toBeNull();
  });

  it('rejects expired refresh token', async () => {
    const rawToken = 'expired_token';
    const hash = tokenService.hashRefreshToken(rawToken);
    const expiredDate = new Date(initialDate.getTime() - 1000);

    await refreshTokenRepo.save({
      id: 'tok-exp',
      accountId: 'acc-1',
      tokenHash: hash,
      familyId: 'family-exp',
      expiresAt: expiredDate,
      createdAt: initialDate,
    });

    await expect(
      useCase.execute({
        refreshToken: rawToken,
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('rejects unknown refresh token', async () => {
    await expect(
      useCase.execute({
        refreshToken: 'unknown_token',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('throws RateLimitedError when rate limit is exceeded', async () => {
    rateLimiter.blockKey('refresh:127.0.0.1');

    await expect(
      useCase.execute({
        refreshToken: 'any_token',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(RateLimitedError);
  });
});
