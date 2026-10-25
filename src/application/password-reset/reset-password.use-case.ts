import { Password } from '../../domain/account/password.vo';
import { AccountRepository } from '../account/ports/account.repository.port';
import { RefreshTokenRepository } from '../account/ports/refresh-token.repository.port';
import { PasswordHasher } from '../account/ports/password-hasher.port';
import { VerificationCodeRepository } from '../verification/ports/verification-code.repository.port';
import { CodeHasher } from '../google-auth/ports/code-hasher.port';
import { RateLimiter } from '../account/ports/rate-limiter.port';
import { Clock } from '../shared/ports/clock.port';
import { InvalidCodeError, RateLimitedError } from '../../domain/account/account.errors';

export interface ResetPasswordInput {
  email: string;
  code: string;
  newPassword: string;
  ip: string;
}

export class ResetPasswordUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly verificationCodeRepository: VerificationCodeRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly rateLimiter: RateLimiter,
    private readonly codeHasher: CodeHasher,
    private readonly clock: Clock,
    private readonly rateLimitMax = 10,
    private readonly rateLimitWindowSeconds = 60,
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const rateLimitKey = `reset-password:${input.ip}`;
    const rateCheck = await this.rateLimiter.consume(
      rateLimitKey,
      this.rateLimitMax,
      this.rateLimitWindowSeconds,
    );
    if (!rateCheck.allowed) {
      throw new RateLimitedError();
    }

    // Validate password VO first (validates 8-72 length)
    const passwordVo = Password.create(input.newPassword);

    const normalizedEmail = (input.email || '').trim().toLowerCase();
    const normalizedCode = (input.code || '').trim();

    if (!normalizedEmail || !normalizedCode) {
      throw new InvalidCodeError();
    }

    const account = await this.accountRepository.findByEmail(normalizedEmail);
    if (!account || !account.hasLoginProvider('password')) {
      throw new InvalidCodeError();
    }

    const latest = await this.verificationCodeRepository.findLatest(
      normalizedEmail,
      'password_reset',
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

    // Mark code as used
    await this.verificationCodeRepository.markUsed(latest.id, now);

    // Hash new password and update
    const newHash = await this.passwordHasher.hash(passwordVo.value);
    await this.accountRepository.updatePassword(account.id, newHash);

    // Revoke all refresh tokens for account
    await this.refreshTokenRepository.revokeAllForAccount(account.id, now);
  }
}
