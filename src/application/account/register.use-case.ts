import { Email } from '../../domain/account/email.vo';
import { Password } from '../../domain/account/password.vo';
import { Account } from '../../domain/account/account.entity';
import { EmailTakenError, RateLimitedError } from '../../domain/account/account.errors';
import { Clock } from '../shared/ports/clock.port';
import { IdGenerator } from '../shared/ports/id-generator.port';
import { AccountRepository } from './ports/account.repository.port';
import { RefreshTokenRepository } from './ports/refresh-token.repository.port';
import { PasswordHasher } from './ports/password-hasher.port';
import { TokenService } from './ports/token.service.port';
import { RateLimiter } from './ports/rate-limiter.port';
import { AuthSessionDto, toUserDto } from './account.dto';

export interface RegisterInput {
  email: string;
  password: string;
  remember?: boolean;
  ip: string;
}

export class RegisterUseCase {
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

  async execute(input: RegisterInput): Promise<AuthSessionDto> {
    const rateLimitKey = `register:${input.ip}`;
    const rateCheck = await this.rateLimiter.consume(
      rateLimitKey,
      this.rateLimitMax,
      this.rateLimitWindowSeconds,
    );
    if (!rateCheck.allowed) {
      throw new RateLimitedError();
    }

    const emailVo = Email.create(input.email);
    const passwordVo = Password.create(input.password);

    const existing = await this.accountRepository.findByEmail(emailVo.value);
    if (existing) {
      throw new EmailTakenError();
    }

    const passwordHash = await this.passwordHasher.hash(passwordVo.value);

    const accountId = this.idGenerator.next();
    const profileId = this.idGenerator.next();
    const now = this.clock.now();

    const account = Account.registerWithPassword({
      id: accountId,
      email: emailVo,
      profileId,
      now,
    });

    await this.accountRepository.createWithPassword(account, passwordHash);

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
