export const GOOGLE_OAUTH_CLIENT = Symbol('GOOGLE_OAUTH_CLIENT');

export interface GoogleUserInfo {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  givenName?: string;
  picture?: string;
}

export interface GoogleOAuthClient {
  getAuthorizationUrl(state: string): string;
  getUserInfo(code: string): Promise<GoogleUserInfo>;
}
