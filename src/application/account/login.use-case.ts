import { InvalidCredentialsError, RateLimitedError } from '../../domain/account/account.errors';
import { Clock } from '../shared/ports/clock.port';
import { IdGenerator } from '../shared/ports/id-generator.port';
import { AccountRepository } from './ports/account.repository.port';
import { RefreshTokenRepository } from './ports/refresh-token.repository.port';
import { PasswordHasher } from './ports/password-hasher.port';
import { TokenService } from './ports/token.service.port';
import { RateLimiter } from './ports/rate-limiter.port';
import { AuthSessionDto, toUserDto } from './account.dto';

export interface LoginInput {
  email: string;
  password: string;
  remember?: boolean;
  ip: string;
}

export class LoginUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly rateLimiter: RateLimiter,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly rateLimitMax = 10,
    private readonly rateLimitWindowSeconds = 60,
  ) {}

  async execute(input: LoginInput): Promise<AuthSessionDto> {
    const rateLimitKey = `login:${input.ip}`;
    const rateCheck = await this.rateLimiter.consume(
      rateLimitKey,
      this.rateLimitMax,
      this.rateLimitWindowSeconds,
    );
    if (!rateCheck.allowed) {
      throw new RateLimitedError();
    }

    const normalizedEmail = (input.email || '').trim().toLowerCase();
    const account = await this.accountRepository.findByEmail(normalizedEmail);

    if (!account || !account.hasLoginProvider('password')) {
      throw new InvalidCredentialsError();
    }

    const hash = await this.accountRepository.getPasswordHash(account.id);
    if (!hash) {
      throw new InvalidCredentialsError();
    }

    const valid = await this.passwordHasher.verify(input.password, hash);
    if (!valid) {
      throw new InvalidCredentialsError();
    }

    const accessToken = await this.tokenService.createAccessToken({ sub: account.id });
    const refreshToken = await this.tokenService.createRefreshToken(input.remember);
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
