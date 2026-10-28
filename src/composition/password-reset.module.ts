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
import { PASSWORD_HASHER, PasswordHasher } from '../application/account/ports/password-hasher.port';
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
import { ForgotPasswordUseCase } from '../application/password-reset/forgot-password.use-case';
import { ResetPasswordUseCase } from '../application/password-reset/reset-password.use-case';
import { PasswordResetController } from '../presentation/http/password-reset/password-reset.controller';

@Module({
  imports: [AccountModule, VerificationModule],
  controllers: [PasswordResetController],
  providers: [
    {
      provide: ForgotPasswordUseCase,
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
        new ForgotPasswordUseCase(
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
    {
      provide: ResetPasswordUseCase,
      useFactory: (
        accountRepo: AccountRepository,
        verificationCodeRepo: VerificationCodeRepository,
        refreshTokenRepo: RefreshTokenRepository,
        passwordHasher: PasswordHasher,
        rateLimiter: RateLimiter,
        codeHasher: CodeHasher,
        clock: Clock,
      ) =>
        new ResetPasswordUseCase(
          accountRepo,
          verificationCodeRepo,
          refreshTokenRepo,
          passwordHasher,
          rateLimiter,
          codeHasher,
          clock,
        ),
      inject: [
        ACCOUNT_REPOSITORY,
        VERIFICATION_CODE_REPOSITORY,
        REFRESH_TOKEN_REPOSITORY,
        PASSWORD_HASHER,
        RATE_LIMITER,
        CODE_HASHER,
        CLOCK,
      ],
    },
  ],
  exports: [ForgotPasswordUseCase, ResetPasswordUseCase],
})
export class PasswordResetModule {}
