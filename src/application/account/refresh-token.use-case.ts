import { RateLimitedError, UnauthorizedError } from '../../domain/account/account.errors';
import { Clock } from '../shared/ports/clock.port';
import { IdGenerator } from '../shared/ports/id-generator.port';
import { AccountRepository } from './ports/account.repository.port';
import { RefreshTokenRepository } from './ports/refresh-token.repository.port';
import { TokenService } from './ports/token.service.port';
import { RateLimiter } from './ports/rate-limiter.port';
import { AuthSessionDto, toUserDto } from './account.dto';

export interface RefreshTokenInput {
  refreshToken: string;
  ip: string;
}

const ONE_DAY_MS = 86_400_000;

export class RefreshTokenUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
    private readonly rateLimiter: RateLimiter,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly rateLimitMax = 10,
    private readonly rateLimitWindowSeconds = 60,
  ) {}

  async execute(input: RefreshTokenInput): Promise<AuthSessionDto> {
    const rateLimitKey = `refresh:${input.ip}`;
    const rateCheck = await this.rateLimiter.consume(
      rateLimitKey,
      this.rateLimitMax,
      this.rateLimitWindowSeconds,
    );
    if (!rateCheck.allowed) {
      throw new RateLimitedError();
    }

    if (!input.refreshToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    const tokenHash = this.tokenService.hashRefreshToken(input.refreshToken);
    const record = await this.refreshTokenRepository.findByTokenHash(tokenHash);

    if (!record) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const now = this.clock.now();

    if (record.revokedAt !== null) {
      // Token reuse detected - revoke entire family / all account tokens
      await this.refreshTokenRepository.revokeAllForAccount(record.accountId, now);
      throw new UnauthorizedError('Refresh token was already revoked');
    }

    if (record.expiresAt.getTime() < now.getTime()) {
      throw new UnauthorizedError('Refresh token has expired');
    }

    const account = await this.accountRepository.findById(record.accountId);
    if (!account) {
      throw new UnauthorizedError('Account not found');
    }

    // Determine whether the existing token was a "remember" token (> 1 day TTL)
    const isRemember =
      record.expiresAt.getTime() - record.createdAt.getTime() > ONE_DAY_MS;

    // Revoke old token
    await this.refreshTokenRepository.revoke(record.id, now);

    // Issue rotated token with same familyId and preserved remember flag
    const newRefresh = await this.tokenService.createRefreshToken(isRemember);
    const newAccess = await this.tokenService.createAccessToken({ sub: account.id });
    const newTokenId = this.idGenerator.next();

    await this.refreshTokenRepository.save({
      id: newTokenId,
      accountId: account.id,
      tokenHash: newRefresh.tokenHash,
      familyId: record.familyId,
      expiresAt: newRefresh.expiresAt,
      createdAt: now,
    });

    return {
      user: toUserDto(account),
      accessToken: newAccess.token,
      expiresAt: newAccess.expiresAt.toISOString(),
      refreshToken: newRefresh.token,
      refreshExpiresAt: newRefresh.expiresAt.toISOString(),
    };
  }
}
