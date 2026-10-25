import { OneTimeExchangeCodeRepository } from './ports/one-time-exchange-code.repository.port';
import { GoogleAuthAccountRepository } from './ports/google-auth-account.repository.port';
import { CodeHasher } from './ports/code-hasher.port';
import { TokenService } from '../account/ports/token.service.port';
import { RefreshTokenRepository } from '../account/ports/refresh-token.repository.port';
import { RateLimiter } from '../account/ports/rate-limiter.port';
import { IdGenerator } from '../shared/ports/id-generator.port';
import { Clock } from '../shared/ports/clock.port';
import { InvalidExchangeCodeError } from '../../domain/google-auth/google-auth.errors';
import { RateLimitedError } from '../../domain/account/account.errors';
import { AuthSessionDto, toUserDto } from '../account/account.dto';

export interface ExchangeCodeInput {
  code: string;
  ip: string;
}

export class ExchangeCodeUseCase {
  constructor(
    private readonly exchangeCodeRepository: OneTimeExchangeCodeRepository,
    private readonly accountRepository: GoogleAuthAccountRepository,
    private readonly tokenService: TokenService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly rateLimiter: RateLimiter,
    private readonly codeHasher: CodeHasher,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly rateLimitMax = 10,
    private readonly rateLimitWindowSeconds = 60,
  ) {}

  async execute(input: ExchangeCodeInput): Promise<AuthSessionDto> {
    const rateLimitKey = `exchange:${input.ip}`;
    const rateCheck = await this.rateLimiter.consume(
      rateLimitKey,
      this.rateLimitMax,
      this.rateLimitWindowSeconds,
    );
    if (!rateCheck.allowed) {
      throw new RateLimitedError();
    }

    const trimmedCode = (input.code || '').trim();
    if (!trimmedCode) {
      throw new InvalidExchangeCodeError();
    }

    const codeHash = this.codeHasher.hash(trimmedCode);
    const now = this.clock.now();

    const consumed = await this.exchangeCodeRepository.consume(codeHash, now);
    if (!consumed) {
      throw new InvalidExchangeCodeError();
    }

    const account = await this.accountRepository.findById(consumed.accountId);
    if (!account) {
      throw new InvalidExchangeCodeError();
    }

    const accessToken = await this.tokenService.createAccessToken({ sub: account.id });
    const refreshToken = await this.tokenService.createRefreshToken(consumed.remember);
    const familyId = this.idGenerator.next();
    const tokenId = this.idGenerator.next();

    await this.refreshTokenRepository.save({
      id: tokenId,
      accountId: account.id,
      tokenHash: refreshToken.tokenHash,
      familyId,
      expiresAt: refreshToken.expiresAt,
    });

    return {
      user: toUserDto(account),
      accessToken: accessToken.token,
      expiresAt: accessToken.expiresAt.toISOString(),
      refreshToken: refreshToken.token,
      refreshExpiresAt: refreshToken.expiresAt.toISOString(),
    };
  }
}
