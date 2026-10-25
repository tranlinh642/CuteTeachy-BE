import { ExchangeCodeUseCase } from '../../../src/application/google-auth/exchange-code.use-case';
import { OneTimeExchangeCodeRepository } from '../../../src/application/google-auth/ports/one-time-exchange-code.repository.port';
import { GoogleAuthAccountRepository } from '../../../src/application/google-auth/ports/google-auth-account.repository.port';
import { CodeHasher } from '../../../src/application/google-auth/ports/code-hasher.port';
import { TokenService } from '../../../src/application/account/ports/token.service.port';
import { RefreshTokenRepository } from '../../../src/application/account/ports/refresh-token.repository.port';
import { RateLimiter } from '../../../src/application/account/ports/rate-limiter.port';
import { IdGenerator } from '../../../src/application/shared/ports/id-generator.port';
import { Clock } from '../../../src/application/shared/ports/clock.port';
import { InvalidExchangeCodeError } from '../../../src/domain/google-auth/google-auth.errors';
import { RateLimitedError } from '../../../src/domain/account/account.errors';
import { Account } from '../../../src/domain/account/account.entity';
import { Email } from '../../../src/domain/account/email.vo';

describe('ExchangeCodeUseCase', () => {
  let useCase: ExchangeCodeUseCase;
  let exchangeCodeRepo: jest.Mocked<OneTimeExchangeCodeRepository>;
  let accountRepo: jest.Mocked<GoogleAuthAccountRepository>;
  let tokenService: jest.Mocked<TokenService>;
  let refreshTokenRepo: jest.Mocked<RefreshTokenRepository>;
  let rateLimiter: jest.Mocked<RateLimiter>;
  let codeHasher: jest.Mocked<CodeHasher>;
  let idGenerator: jest.Mocked<IdGenerator>;
  let clock: jest.Mocked<Clock>;

  const fixedNow = new Date('2026-10-25T12:00:00Z');
  const dummyAccount = Account.registerWithGoogle({
    id: 'acc-123',
    email: Email.create('teacher@example.com'),
    profileId: 'prof-123',
    fullName: 'Teacher Cute',
    displayName: 'Teacher',
    avatarUrl: 'https://avatar.url',
    now: fixedNow,
  });

  beforeEach(() => {
    exchangeCodeRepo = {
      create: jest.fn(),
      consume: jest.fn(),
    };
    accountRepo = {
      findByProviderSubject: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      createWithGoogle: jest.fn(),
      linkGoogleProvider: jest.fn(),
    };
    tokenService = {
      createAccessToken: jest.fn(),
      verifyAccessToken: jest.fn(),
      createRefreshToken: jest.fn(),
      hashRefreshToken: jest.fn(),
    };
    refreshTokenRepo = {
      save: jest.fn(),
      findByTokenHash: jest.fn(),
      revoke: jest.fn(),
      revokeAllForAccount: jest.fn(),
    };
    rateLimiter = {
      consume: jest.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: fixedNow }),
    };
    codeHasher = {
      hash: jest.fn().mockImplementation((c) => `hashed_${c}`),
    };
    idGenerator = {
      next: jest.fn().mockReturnValue('id-gen-1'),
      generate: jest.fn().mockReturnValue('code-gen-1'),
    };
    clock = {
      now: jest.fn().mockReturnValue(fixedNow),
    };

    useCase = new ExchangeCodeUseCase(
      exchangeCodeRepo,
      accountRepo,
      tokenService,
      refreshTokenRepo,
      rateLimiter,
      codeHasher,
      idGenerator,
      clock,
    );
  });

  it('exchanges valid code successfully with remember=true and returns AuthSession', async () => {
    exchangeCodeRepo.consume.mockResolvedValue({
      id: 'code-id-1',
      accountId: 'acc-123',
      remember: true,
    });
    accountRepo.findById.mockResolvedValue(dummyAccount);

    tokenService.createAccessToken.mockResolvedValue({
      token: 'jwt-access-token',
      expiresAt: new Date(fixedNow.getTime() + 15 * 60 * 1000),
    });
    tokenService.createRefreshToken.mockResolvedValue({
      token: 'raw-refresh-token',
      tokenHash: 'hashed-refresh-token',
      expiresAt: new Date(fixedNow.getTime() + 30 * 24 * 3600 * 1000),
    });

    const result = await useCase.execute({
      code: 'valid-one-time-code',
      ip: '127.0.0.1',
    });

    expect(rateLimiter.consume).toHaveBeenCalledWith('exchange:127.0.0.1', 10, 60);
    expect(codeHasher.hash).toHaveBeenCalledWith('valid-one-time-code');
    expect(exchangeCodeRepo.consume).toHaveBeenCalledWith('hashed_valid-one-time-code', fixedNow);
    expect(accountRepo.findById).toHaveBeenCalledWith('acc-123');
    expect(tokenService.createAccessToken).toHaveBeenCalledWith({ sub: 'acc-123' });
    expect(tokenService.createRefreshToken).toHaveBeenCalledWith(true);

    expect(refreshTokenRepo.save).toHaveBeenCalledWith({
      id: 'id-gen-1',
      accountId: 'acc-123',
      tokenHash: 'hashed-refresh-token',
      familyId: 'id-gen-1',
      expiresAt: expect.any(Date),
    });

    expect(result.user.id).toBe('acc-123');
    expect(result.user.email).toBe('teacher@example.com');
    expect(result.user.emailVerified).toBe(true);
    expect(result.user.fullName).toBe('Teacher Cute');
    expect(result.accessToken).toBe('jwt-access-token');
    expect(result.refreshToken).toBe('raw-refresh-token');
  });

  it('exchanges valid code with remember=false passing remember=false to refreshToken', async () => {
    exchangeCodeRepo.consume.mockResolvedValue({
      id: 'code-id-2',
      accountId: 'acc-123',
      remember: false,
    });
    accountRepo.findById.mockResolvedValue(dummyAccount);

    tokenService.createAccessToken.mockResolvedValue({
      token: 'jwt-access-token',
      expiresAt: new Date(fixedNow.getTime() + 15 * 60 * 1000),
    });
    tokenService.createRefreshToken.mockResolvedValue({
      token: 'raw-refresh-token-session',
      tokenHash: 'hashed-refresh-token-session',
      expiresAt: new Date(fixedNow.getTime() + 24 * 3600 * 1000),
    });

    const result = await useCase.execute({
      code: 'valid-session-code',
      ip: '10.0.0.1',
    });

    expect(tokenService.createRefreshToken).toHaveBeenCalledWith(false);
    expect(result.refreshToken).toBe('raw-refresh-token-session');
  });

  it('throws RateLimitedError when rate limit is exceeded', async () => {
    rateLimiter.consume.mockResolvedValue({ allowed: false, remaining: 0, resetAt: fixedNow });

    await expect(
      useCase.execute({
        code: 'any-code',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(RateLimitedError);

    expect(exchangeCodeRepo.consume).not.toHaveBeenCalled();
  });

  it('throws InvalidExchangeCodeError when code is not found, expired, or already used', async () => {
    exchangeCodeRepo.consume.mockResolvedValue(null);

    await expect(
      useCase.execute({
        code: 'expired-or-used-code',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(InvalidExchangeCodeError);

    try {
      await useCase.execute({
        code: 'expired-or-used-code',
        ip: '127.0.0.1',
      });
    } catch (err: any) {
      expect(err.code).toBe('invalid_code');
    }
  });

  it('throws InvalidExchangeCodeError on empty code', async () => {
    await expect(
      useCase.execute({
        code: '',
        ip: '127.0.0.1',
      }),
    ).rejects.toThrow(InvalidExchangeCodeError);
  });
});
