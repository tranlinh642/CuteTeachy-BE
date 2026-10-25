import { GoogleOAuthClient } from './ports/google-oauth.client.port';
import { OAuthStateSigner } from './ports/oauth-state-signer.port';
import { IdGenerator } from '../shared/ports/id-generator.port';

export interface GetGoogleAuthUrlInput {
  remember?: boolean;
}

export interface GetGoogleAuthUrlOutput {
  url: string;
}

export class GetGoogleAuthUrlUseCase {
  constructor(
    private readonly googleOAuthClient: GoogleOAuthClient,
    private readonly oauthStateSigner: OAuthStateSigner,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(input?: GetGoogleAuthUrlInput): Promise<GetGoogleAuthUrlOutput> {
    const nonce = this.idGenerator.next();
    const remember = Boolean(input?.remember);
    const state = this.oauthStateSigner.sign({ remember, nonce });
    const url = this.googleOAuthClient.getAuthorizationUrl(state);

    return { url };
  }
}
