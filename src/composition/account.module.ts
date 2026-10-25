import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CLOCK, Clock } from '../application/shared/ports/clock.port';
import { ID_GENERATOR, IdGenerator } from '../application/shared/ports/id-generator.port';
import { MAILER, Mailer } from '../application/shared/ports/mailer.port';
import { APP_CONFIG, AppConfig } from '../infrastructure/config/app.config';
import {
  ACCOUNT_REPOSITORY,
  AccountRepository,
} from '../application/account/ports/account.repository.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../application/account/ports/refresh-token.repository.port';
import { PASSWORD_HASHER, PasswordHasher } from '../application/account/ports/password-hasher.port';
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

import { RegisterUseCase } from '../application/account/register.use-case';
import { LoginUseCase } from '../application/account/login.use-case';
import { RefreshTokenUseCase } from '../application/account/refresh-token.use-case';
import { LogoutUseCase } from '../application/account/logout.use-case';
import { GetMeUseCase } from '../application/account/get-me.use-case';
import { UpdateProfileUseCase } from '../application/account/update-profile.use-case';

import { PrismaAccountRepository } from '../infrastructure/persistence/prisma/repositories/prisma-account.repository';
import { PrismaRefreshTokenRepository } from '../infrastructure/persistence/prisma/repositories/prisma-refresh-token.repository';
import { Argon2PasswordHasher } from '../infrastructure/auth/argon2-password-hasher';
import { JwtTokenService } from '../infrastructure/auth/jwt-token.service';
import { PostgresRateLimiter } from '../infrastructure/auth/postgres-rate-limiter';

import { AuthController } from '../presentation/http/account/auth.controller';
import { JwtAuthGuard } from '../presentation/http/auth/jwt-auth.guard';
import { OnboardingGuard } from '../presentation/http/auth/onboarding.guard';
import { VerificationModule } from './verification.module';

@Module({
  imports: [VerificationModule],
  controllers: [AuthController],
  providers: [
    {
      provide: ACCOUNT_REPOSITORY,
      useClass: PrismaAccountRepository,
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: PrismaRefreshTokenRepository,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: Argon2PasswordHasher,
    },
    {
      provide: TOKEN_SERVICE,
      useClass: JwtTokenService,
    },
    {
      provide: RATE_LIMITER,
      useClass: PostgresRateLimiter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OnboardingGuard,
    },
    {
      provide: RegisterUseCase,
      useFactory: (
        accountRepo: AccountRepository,
        refreshTokenRepo: RefreshTokenRepository,
        passwordHasher: PasswordHasher,
        tokenService: TokenService,
        rateLimiter: RateLimiter,
        idGenerator: IdGenerator,
        clock: Clock,
        verificationCodeRepo: VerificationCodeRepository,
        codeHasher: CodeHasher,
        mailer: Mailer,
        codeGenerator: CodeGenerator,
      ) =>
        new RegisterUseCase(
          accountRepo,
          refreshTokenRepo,
          passwordHasher,
          tokenService,
          rateLimiter,
          idGenerator,
          clock,
          verificationCodeRepo,
          codeHasher,
          mailer,
          codeGenerator,
        ),
      inject: [
        ACCOUNT_REPOSITORY,
        REFRESH_TOKEN_REPOSITORY,
        PASSWORD_HASHER,
        TOKEN_SERVICE,
        RATE_LIMITER,
        ID_GENERATOR,
        CLOCK,
        VERIFICATION_CODE_REPOSITORY,
        CODE_HASHER,
        MAILER,
        CODE_GENERATOR,
      ],
    },
    {
      provide: LoginUseCase,
      useFactory: (
        accountRepo: AccountRepository,
        refreshTokenRepo: RefreshTokenRepository,
        passwordHasher: PasswordHasher,
        tokenService: TokenService,
        rateLimiter: RateLimiter,
        idGenerator: IdGenerator,
        clock: Clock,
        config: AppConfig,
      ) =>
        new LoginUseCase(
          accountRepo,
          refreshTokenRepo,
          passwordHasher,
          tokenService,
          rateLimiter,
          idGenerator,
          clock,
          10,
          60,
          config.EMAIL_VERIFICATION_REQUIRED,
        ),
      inject: [
        ACCOUNT_REPOSITORY,
        REFRESH_TOKEN_REPOSITORY,
        PASSWORD_HASHER,
        TOKEN_SERVICE,
        RATE_LIMITER,
        ID_GENERATOR,
        CLOCK,
        APP_CONFIG,
      ],
    },
    {
      provide: RefreshTokenUseCase,
      useFactory: (
        accountRepo: AccountRepository,
        refreshTokenRepo: RefreshTokenRepository,
        tokenService: TokenService,
        rateLimiter: RateLimiter,
        idGenerator: IdGenerator,
        clock: Clock,
      ) =>
        new RefreshTokenUseCase(
          accountRepo,
          refreshTokenRepo,
          tokenService,
          rateLimiter,
          idGenerator,
          clock,
        ),
      inject: [
        ACCOUNT_REPOSITORY,
        REFRESH_TOKEN_REPOSITORY,
        TOKEN_SERVICE,
        RATE_LIMITER,
        ID_GENERATOR,
        CLOCK,
      ],
    },
    {
      provide: LogoutUseCase,
      useFactory: (
        refreshTokenRepo: RefreshTokenRepository,
        tokenService: TokenService,
        clock: Clock,
      ) => new LogoutUseCase(refreshTokenRepo, tokenService, clock),
      inject: [REFRESH_TOKEN_REPOSITORY, TOKEN_SERVICE, CLOCK],
    },
    {
      provide: GetMeUseCase,
      useFactory: (accountRepo: AccountRepository) => new GetMeUseCase(accountRepo),
      inject: [ACCOUNT_REPOSITORY],
    },
    {
      provide: UpdateProfileUseCase,
      useFactory: (accountRepo: AccountRepository, clock: Clock) =>
        new UpdateProfileUseCase(accountRepo, clock),
      inject: [ACCOUNT_REPOSITORY, CLOCK],
    },
  ],
  exports: [
    ACCOUNT_REPOSITORY,
    REFRESH_TOKEN_REPOSITORY,
    PASSWORD_HASHER,
    TOKEN_SERVICE,
    RATE_LIMITER,
    RegisterUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    GetMeUseCase,
    UpdateProfileUseCase,
  ],
})
export class AccountModule {}
