export const OAUTH_STATE_SIGNER = Symbol('OAUTH_STATE_SIGNER');

export interface OAuthStatePayload {
  remember: boolean;
  nonce: string;
}

export interface OAuthStateSigner {
  sign(payload: OAuthStatePayload): string;
  verify(token: string): OAuthStatePayload | null;
}
