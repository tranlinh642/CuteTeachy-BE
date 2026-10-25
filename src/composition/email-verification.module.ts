import { Module } from '@nestjs/common';
import { AccountModule } from './account.module';
import { VerificationModule } from './verification.module';
import { CLOCK, Clock } from '../application/shared/ports/clock.port';
import { ID_GENERATOR, IdGenerator } from '../application/shared/ports/id-generator.port';
import { MAILER, Mailer } from '../application/shared/ports/mailer.port';
import {
  ACCOUNT_REPOSITORY,
  AccountRepository,
} from '../application/account/ports/account.repository.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../application/account/ports/refresh-token.repository.port';
import { TOKEN_SERVICE, TokenService } from '../application/account/ports/token.service.port';
import { RATE_LIMITER, RateLimiter } from '../application/account/ports/rate-limiter.port';
import {
  VERIFICATION_CODE_REPOSITORY,
  VerificationCodeRepository,
} from '../application/verification/ports/verification-code.repository.port';
import { CODE_HASHER, CodeHasher } from '../application/google-auth/ports/code-hasher.port';
import {
  CODE_GENERATOR,
  CodeGenerator,
} from '../application/verification/ports/code-generator.port';
import { VerifyEmailUseCase } from '../application/email-verification/verify-email.use-case';
import { ResendVerificationEmailUseCase } from '../application/email-verification/resend-verification-email.use-case';
import { EmailVerificationController } from '../presentation/http/email-verification/email-verification.controller';

@Module({
  imports: [AccountModule, VerificationModule],
  controllers: [EmailVerificationController],
  providers: [
    {
      provide: VerifyEmailUseCase,
      useFactory: (
        accountRepo: AccountRepository,
        verificationCodeRepo: VerificationCodeRepository,
        refreshTokenRepo: RefreshTokenRepository,
        tokenService: TokenService,
        rateLimiter: RateLimiter,
        codeHasher: CodeHasher,
        idGenerator: IdGenerator,
        clock: Clock,
      ) =>
        new VerifyEmailUseCase(
          accountRepo,
          verificationCodeRepo,
          refreshTokenRepo,
          tokenService,
          rateLimiter,
          codeHasher,
          idGenerator,
          clock,
        ),
      inject: [
        ACCOUNT_REPOSITORY,
        VERIFICATION_CODE_REPOSITORY,
        REFRESH_TOKEN_REPOSITORY,
        TOKEN_SERVICE,
        RATE_LIMITER,
        CODE_HASHER,
        ID_GENERATOR,
        CLOCK,
      ],
    },
    {
      provide: ResendVerificationEmailUseCase,
      useFactory: (
        accountRepo: AccountRepository,
        verificationCodeRepo: VerificationCodeRepository,
        mailer: Mailer,
        codeHasher: CodeHasher,
        rateLimiter: RateLimiter,
        idGenerator: IdGenerator,
        clock: Clock,
        codeGenerator: CodeGenerator,
      ) =>
        new ResendVerificationEmailUseCase(
          accountRepo,
          verificationCodeRepo,
          mailer,
          codeHasher,
          rateLimiter,
          idGenerator,
          clock,
          codeGenerator,
        ),
      inject: [
        ACCOUNT_REPOSITORY,
        VERIFICATION_CODE_REPOSITORY,
        MAILER,
        CODE_HASHER,
        RATE_LIMITER,
        ID_GENERATOR,
        CLOCK,
        CODE_GENERATOR,
      ],
    },
  ],
  exports: [VerifyEmailUseCase, ResendVerificationEmailUseCase],
})
export class EmailVerificationModule {}
