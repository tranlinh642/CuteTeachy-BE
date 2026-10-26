import { Module } from '@nestjs/common';
import { AccountModule } from './account.module';
import { SettingsModule } from './settings.module';
import {
  SETTINGS_REPOSITORY,
  SettingsRepository,
} from '../application/settings/ports/settings.repository.port';
import { CLOCK, Clock } from '../application/shared/ports/clock.port';
import { ID_GENERATOR, IdGenerator } from '../application/shared/ports/id-generator.port';
import { APP_CONFIG, AppConfig } from '../infrastructure/config/app.config';
import {
  TOKEN_SERVICE,
  TokenService,
} from '../application/account/ports/token.service.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../application/account/ports/refresh-token.repository.port';
import {
  RATE_LIMITER,
  RateLimiter,
} from '../application/account/ports/rate-limiter.port';

import {
  GOOGLE_OAUTH_CLIENT,
  GoogleOAuthClient,
} from '../application/google-auth/ports/google-oauth.client.port';
import {
  OAUTH_STATE_SIGNER,
  OAuthStateSigner,
} from '../application/google-auth/ports/oauth-state-signer.port';
import {
  CODE_HASHER,
  CodeHasher,
} from '../application/google-auth/ports/code-hasher.port';
import {
  ONE_TIME_EXCHANGE_CODE_REPOSITORY,
  OneTimeExchangeCodeRepository,
} from '../application/google-auth/ports/one-time-exchange-code.repository.port';
import {
  GOOGLE_AUTH_ACCOUNT_REPOSITORY,
  GoogleAuthAccountRepository,
} from '../application/google-auth/ports/google-auth-account.repository.port';

import {
  GOOGLE_OAUTH_CONFIG,
  loadGoogleOAuthConfig,
} from '../infrastructure/google-auth/google-oauth.config';
import { GoogleOAuthClientImpl } from '../infrastructure/google-auth/google-oauth.client';
import { JwtOAuthStateSigner } from '../infrastructure/google-auth/jwt-oauth-state-signer';
import { Sha256CodeHasher } from '../infrastructure/google-auth/sha256-code-hasher';
import { PrismaOneTimeExchangeCodeRepository } from '../infrastructure/google-auth/persistence/prisma-one-time-exchange-code.repository';
import { PrismaGoogleAuthAccountRepository } from '../infrastructure/google-auth/persistence/prisma-google-auth-account.repository';

import { GetGoogleAuthUrlUseCase } from '../application/google-auth/get-google-auth-url.use-case';
import { HandleGoogleCallbackUseCase } from '../application/google-auth/handle-google-callback.use-case';
import { ExchangeCodeUseCase } from '../application/google-auth/exchange-code.use-case';

import { GoogleAuthController } from '../presentation/http/google-auth/google-auth.controller';

@Module({
  imports: [AccountModule, SettingsModule],
  controllers: [GoogleAuthController],
  providers: [
    {
      provide: GOOGLE_OAUTH_CONFIG,
      useFactory: () => loadGoogleOAuthConfig(),
    },
    {
      provide: GOOGLE_OAUTH_CLIENT,
      useClass: GoogleOAuthClientImpl,
    },
    {
      provide: OAUTH_STATE_SIGNER,
      useClass: JwtOAuthStateSigner,
    },
    {
      provide: CODE_HASHER,
      useClass: Sha256CodeHasher,
    },
    {
      provide: ONE_TIME_EXCHANGE_CODE_REPOSITORY,
      useClass: PrismaOneTimeExchangeCodeRepository,
    },
    {
      provide: GOOGLE_AUTH_ACCOUNT_REPOSITORY,
      useClass: PrismaGoogleAuthAccountRepository,
    },
    {
      provide: GetGoogleAuthUrlUseCase,
      useFactory: (
        googleClient: GoogleOAuthClient,
        stateSigner: OAuthStateSigner,
        idGenerator: IdGenerator,
      ) => new GetGoogleAuthUrlUseCase(googleClient, stateSigner, idGenerator),
      inject: [GOOGLE_OAUTH_CLIENT, OAUTH_STATE_SIGNER, ID_GENERATOR],
    },
    {
      provide: HandleGoogleCallbackUseCase,
      useFactory: (
        accountRepo: GoogleAuthAccountRepository,
        exchangeCodeRepo: OneTimeExchangeCodeRepository,
        googleClient: GoogleOAuthClient,
        stateSigner: OAuthStateSigner,
        codeHasher: CodeHasher,
        idGenerator: IdGenerator,
        clock: Clock,
        config: AppConfig,
        settingsRepo: SettingsRepository,
      ) =>
        new HandleGoogleCallbackUseCase(
          accountRepo,
          exchangeCodeRepo,
          googleClient,
          stateSigner,
          codeHasher,
          idGenerator,
          clock,
          config.FE_URL,
          settingsRepo,
        ),
      inject: [
        GOOGLE_AUTH_ACCOUNT_REPOSITORY,
        ONE_TIME_EXCHANGE_CODE_REPOSITORY,
        GOOGLE_OAUTH_CLIENT,
        OAUTH_STATE_SIGNER,
        CODE_HASHER,
        ID_GENERATOR,
        CLOCK,
        APP_CONFIG,
        SETTINGS_REPOSITORY,
      ],
    },
    {
      provide: ExchangeCodeUseCase,
      useFactory: (
        exchangeCodeRepo: OneTimeExchangeCodeRepository,
        accountRepo: GoogleAuthAccountRepository,
        tokenService: TokenService,
        refreshTokenRepo: RefreshTokenRepository,
        rateLimiter: RateLimiter,
        codeHasher: CodeHasher,
        idGenerator: IdGenerator,
        clock: Clock,
      ) =>
        new ExchangeCodeUseCase(
          exchangeCodeRepo,
          accountRepo,
          tokenService,
          refreshTokenRepo,
          rateLimiter,
          codeHasher,
          idGenerator,
          clock,
        ),
      inject: [
        ONE_TIME_EXCHANGE_CODE_REPOSITORY,
        GOOGLE_AUTH_ACCOUNT_REPOSITORY,
        TOKEN_SERVICE,
        REFRESH_TOKEN_REPOSITORY,
        RATE_LIMITER,
        CODE_HASHER,
        ID_GENERATOR,
        CLOCK,
      ],
    },
  ],
  exports: [
    GOOGLE_OAUTH_CLIENT,
    OAUTH_STATE_SIGNER,
    CODE_HASHER,
    ONE_TIME_EXCHANGE_CODE_REPOSITORY,
    GOOGLE_AUTH_ACCOUNT_REPOSITORY,
    GetGoogleAuthUrlUseCase,
    HandleGoogleCallbackUseCase,
    ExchangeCodeUseCase,
  ],
})
export class GoogleAuthModule {}
