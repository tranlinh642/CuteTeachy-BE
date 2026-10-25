import { AccountRepository } from '../account/ports/account.repository.port';
import { RefreshTokenRepository } from '../account/ports/refresh-token.repository.port';
import { TokenService } from '../account/ports/token.service.port';
import { RateLimiter } from '../account/ports/rate-limiter.port';
import { VerificationCodeRepository } from '../verification/ports/verification-code.repository.port';
import { CodeHasher } from '../google-auth/ports/code-hasher.port';
import { IdGenerator } from '../shared/ports/id-generator.port';
import { Clock } from '../shared/ports/clock.port';
import { InvalidCodeError, RateLimitedError } from '../../domain/account/account.errors';
import { AuthSessionDto, toUserDto } from '../account/account.dto';

export interface VerifyEmailInput {
  email: string;
  code: string;
  ip: string;
}

export class VerifyEmailUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly verificationCodeRepository: VerificationCodeRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
    private readonly rateLimiter: RateLimiter,
    private readonly codeHasher: CodeHasher,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly rateLimitMax = 10,
    private readonly rateLimitWindowSeconds = 60,
  ) {}

  async execute(input: VerifyEmailInput): Promise<AuthSessionDto> {
    const rateLimitKey = `verify-email:${input.ip}`;
    const rateCheck = await this.rateLimiter.consume(
      rateLimitKey,
      this.rateLimitMax,
      this.rateLimitWindowSeconds,
    );
    if (!rateCheck.allowed) {
      throw new RateLimitedError();
    }

    const normalizedEmail = (input.email || '').trim().toLowerCase();
    const normalizedCode = (input.code || '').trim();

    if (!normalizedEmail || !normalizedCode) {
      throw new InvalidCodeError();
    }

    const account = await this.accountRepository.findByEmail(normalizedEmail);
    if (!account) {
      throw new InvalidCodeError();
    }

    const latest = await this.verificationCodeRepository.findLatest(
      normalizedEmail,
      'email_verification',
    );
    if (!latest) {
      throw new InvalidCodeError();
    }

    const now = this.clock.now();

    if (latest.usedAt !== null || now > latest.expiresAt || latest.attempts >= latest.maxAttempts) {
      throw new InvalidCodeError();
    }

    const inputHash = this.codeHasher.hash(normalizedCode);
    if (inputHash !== latest.codeHash) {
      await this.verificationCodeRepository.incrementAttempts(latest.id);
      throw new InvalidCodeError();
    }

    await this.verificationCodeRepository.markUsed(latest.id, now);

    account.verifyEmail(now);
    await this.accountRepository.markEmailVerified(account.id, now);

    const accessToken = await this.tokenService.createAccessToken({ sub: account.id });
    const refreshToken = await this.tokenService.createRefreshToken(false);
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
