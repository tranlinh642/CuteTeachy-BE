import { AccountRepository } from '../account/ports/account.repository.port';
import { VerificationCodeRepository } from '../verification/ports/verification-code.repository.port';
import { Mailer } from '../shared/ports/mailer.port';
import { CodeHasher } from '../google-auth/ports/code-hasher.port';
import { RateLimiter } from '../account/ports/rate-limiter.port';
import { IdGenerator } from '../shared/ports/id-generator.port';
import { Clock } from '../shared/ports/clock.port';
import { CodeGenerator } from '../verification/ports/code-generator.port';
import { RateLimitedError } from '../../domain/account/account.errors';
import {
  buildPasswordResetEmail,
  resolveLanguage,
} from '../email-templates/verification-email.template';

export interface ForgotPasswordInput {
  email: string;
  ip: string;
  acceptLanguage?: string;
}

export class ForgotPasswordUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly verificationCodeRepository: VerificationCodeRepository,
    private readonly mailer: Mailer,
    private readonly codeHasher: CodeHasher,
    private readonly rateLimiter: RateLimiter,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly codeGenerator?: CodeGenerator,
    private readonly rateLimitMax = 10,
    private readonly rateLimitWindowSeconds = 60,
  ) {}

  async execute(input: ForgotPasswordInput): Promise<void> {
    const rateLimitKey = `forgot-password:${input.ip}`;
    const rateCheck = await this.rateLimiter.consume(
      rateLimitKey,
      this.rateLimitMax,
      this.rateLimitWindowSeconds,
    );
    if (!rateCheck.allowed) {
      throw new RateLimitedError();
    }

    const normalizedEmail = (input.email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }

    const account = await this.accountRepository.findByEmail(normalizedEmail);
    if (!account || !account.hasLoginProvider('password')) {
      return; // timing safe
    }

    const now = this.clock.now();

    // Check cooldown for same email
    const latest = await this.verificationCodeRepository.findLatest(
      normalizedEmail,
      'password_reset',
    );
    if (latest) {
      const elapsedSeconds = (now.getTime() - latest.createdAt.getTime()) / 1000;
      if (elapsedSeconds < 60) {
        return; // timing safe: avoid spamming while still returning 204
      }
    }

    const code =
      this.codeGenerator?.generate() ??
      Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = this.codeHasher.hash(code);
    const verificationCodeId = this.idGenerator.next();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes TTL

    await this.verificationCodeRepository.create({
      id: verificationCodeId,
      email: normalizedEmail,
      accountId: account.id,
      purpose: 'password_reset',
      codeHash,
      expiresAt,
      maxAttempts: 5,
      now,
    });

    const lang = resolveLanguage(input.acceptLanguage);
    const emailContent = buildPasswordResetEmail(code, lang);
    await this.mailer.sendEmail(
      normalizedEmail,
      emailContent.subject,
      emailContent.html,
      emailContent.text,
    );
  }
}
