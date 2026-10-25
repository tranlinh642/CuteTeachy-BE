import { GoogleOAuthClient } from './ports/google-oauth.client.port';
import { OAuthStateSigner } from './ports/oauth-state-signer.port';
import { OneTimeExchangeCodeRepository } from './ports/one-time-exchange-code.repository.port';
import { GoogleAuthAccountRepository } from './ports/google-auth-account.repository.port';
import { CodeHasher } from './ports/code-hasher.port';
import { IdGenerator } from '../shared/ports/id-generator.port';
import { Clock } from '../shared/ports/clock.port';
import { Account } from '../../domain/account/account.entity';
import { Email } from '../../domain/account/email.vo';

export interface HandleGoogleCallbackInput {
  code?: string;
  state?: string;
  error?: string;
}

export interface HandleGoogleCallbackOutput {
  redirectUrl: string;
}

export class HandleGoogleCallbackUseCase {
  constructor(
    private readonly googleAuthAccountRepository: GoogleAuthAccountRepository,
    private readonly exchangeCodeRepository: OneTimeExchangeCodeRepository,
    private readonly googleOAuthClient: GoogleOAuthClient,
    private readonly oauthStateSigner: OAuthStateSigner,
    private readonly codeHasher: CodeHasher,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly feUrl: string,
  ) {}

  async execute(input: HandleGoogleCallbackInput): Promise<HandleGoogleCallbackOutput> {
    const failedUrl = `${this.feUrl}/auth/callback?error=google_failed`;

    if (input.error || !input.code || !input.state) {
      return { redirectUrl: failedUrl };
    }

    const statePayload = this.oauthStateSigner.verify(input.state);
    if (!statePayload) {
      return { redirectUrl: failedUrl };
    }
    const remember = statePayload.remember;

    let userInfo;
    try {
      userInfo = await this.googleOAuthClient.getUserInfo(input.code);
    } catch {
      return { redirectUrl: failedUrl };
    }

    if (!userInfo || !userInfo.emailVerified || !userInfo.email || !userInfo.sub) {
      return { redirectUrl: failedUrl };
    }

    const normalizedEmail = userInfo.email.trim().toLowerCase();
    const now = this.clock.now();

    // 1. Look up by provider 'google' and subject
    let account = await this.googleAuthAccountRepository.findByProviderSubject(
      'google',
      userInfo.sub,
    );

    if (!account) {
      // 2. Look up by email (Account Linking)
      const existingAccount = await this.googleAuthAccountRepository.findByEmail(
        normalizedEmail,
      );

      if (existingAccount) {
        await this.googleAuthAccountRepository.linkGoogleProvider(
          existingAccount.id,
          userInfo.sub,
        );
        existingAccount.linkGoogle();
        account = existingAccount;
      } else {
        // 3. Create new Account via Google
        const accountId = this.idGenerator.next();
        const profileId = this.idGenerator.next();
        const emailVo = Email.create(normalizedEmail);

        account = Account.registerWithGoogle({
          id: accountId,
          email: emailVo,
          profileId,
          fullName: userInfo.name || '',
          displayName: userInfo.givenName || userInfo.name || '',
          avatarUrl: userInfo.picture,
          now,
        });

        await this.googleAuthAccountRepository.createWithGoogle(account, userInfo.sub);
      }
    }

    // 4. Generate one-time exchange code
    const rawCode = this.idGenerator.generate();
    const codeHash = this.codeHasher.hash(rawCode);
    const expiresAt = new Date(now.getTime() + 60 * 1000); // 60s TTL

    await this.exchangeCodeRepository.create({
      id: this.idGenerator.next(),
      accountId: account.id,
      codeHash,
      remember,
      expiresAt,
    });

    return {
      redirectUrl: `${this.feUrl}/auth/callback?code=${rawCode}`,
    };
  }
}
