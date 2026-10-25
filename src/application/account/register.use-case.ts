import { Email } from '../../domain/account/email.vo';
import { Password } from '../../domain/account/password.vo';
import { Account } from '../../domain/account/account.entity';
import { EmailTakenError, RateLimitedError } from '../../domain/account/account.errors';
import { Clock } from '../shared/ports/clock.port';
import { IdGenerator } from '../shared/ports/id-generator.port';
import { Mailer } from '../shared/ports/mailer.port';
import { AccountRepository } from './ports/account.repository.port';
import { RefreshTokenRepository } from './ports/refresh-token.repository.port';
import { PasswordHasher } from './ports/password-hasher.port';
import { TokenService } from './ports/token.service.port';
import { RateLimiter } from './ports/rate-limiter.port';
import { CodeHasher } from '../google-auth/ports/code-hasher.port';
import { VerificationCodeRepository } from '../verification/ports/verification-code.repository.port';
import { CodeGenerator } from '../verification/ports/code-generator.port';
import {
  buildEmailVerificationEmail,
  resolveLanguage,
} from '../email-templates/verification-email.template';
import { AuthSessionDto, toUserDto } from './account.dto';

export interface RegisterInput {
  email: string;
  password: string;
  remember?: boolean;
  ip: string;
  acceptLanguage?: string;
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
    private readonly verificationCodeRepository: VerificationCodeRepository,
    private readonly codeHasher: CodeHasher,
    private readonly mailer: Mailer,
    private readonly codeGenerator: CodeGenerator,
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

    // Verification code generation & email dispatch
    const code = this.codeGenerator.generate();
    const codeHash = this.codeHasher.hash(code);
    const verificationCodeId = this.idGenerator.next();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes TTL

    await this.verificationCodeRepository.create({
      id: verificationCodeId,
      email: account.email,
      accountId: account.id,
      purpose: 'email_verification',
      codeHash,
      expiresAt,
      maxAttempts: 5,
    });

    const lang = resolveLanguage(input.acceptLanguage);
    const emailContent = buildEmailVerificationEmail(code, lang);
    await this.mailer.sendEmail(
      account.email,
      emailContent.subject,
      emailContent.html,
      emailContent.text,
    );

    return {
      user: toUserDto(account),
      accessToken: accessToken.token,
      expiresAt: accessToken.expiresAt.toISOString(),
      refreshToken: refreshToken.token,
      refreshExpiresAt: refreshToken.expiresAt.toISOString(),
    };
  }
}
