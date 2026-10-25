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
  buildEmailVerificationEmail,
  resolveLanguage,
} from '../email-templates/verification-email.template';

export interface ResendVerificationEmailInput {
  email: string;
  ip: string;
  acceptLanguage?: string;
}

export class ResendVerificationEmailUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly verificationCodeRepository: VerificationCodeRepository,
    private readonly mailer: Mailer,
    private readonly codeHasher: CodeHasher,
    private readonly rateLimiter: RateLimiter,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly codeGenerator: CodeGenerator,
    private readonly rateLimitMax = 10,
    private readonly rateLimitWindowSeconds = 60,
  ) {}

  async execute(input: ResendVerificationEmailInput): Promise<void> {
    const rateLimitKey = `resend-email:${input.ip}`;
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

    const now = this.clock.now();

    // Check cooldown: must be at least 60s since latest code creation
    const latest = await this.verificationCodeRepository.findLatest(
      normalizedEmail,
      'email_verification',
    );
    if (latest) {
      const elapsedSeconds = (now.getTime() - latest.createdAt.getTime()) / 1000;
      if (elapsedSeconds < 60) {
        throw new RateLimitedError('Please wait at least 60 seconds before requesting a new code');
      }
    }

    const account = await this.accountRepository.findByEmail(normalizedEmail);
    if (!account || account.emailVerifiedAt !== null) {
      return;
    }

    const code = this.codeGenerator.generate();
    const codeHash = this.codeHasher.hash(code);
    const verificationCodeId = this.idGenerator.next();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes TTL

    await this.verificationCodeRepository.create({
      id: verificationCodeId,
      email: normalizedEmail,
      accountId: account.id,
      purpose: 'email_verification',
      codeHash,
      expiresAt,
      maxAttempts: 5,
      now,
    });

    const lang = resolveLanguage(input.acceptLanguage);
    const emailContent = buildEmailVerificationEmail(code, lang);
    await this.mailer.sendEmail(
      normalizedEmail,
      emailContent.subject,
      emailContent.html,
      emailContent.text,
    );
  }
}
