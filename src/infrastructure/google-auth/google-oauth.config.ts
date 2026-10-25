export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export const GOOGLE_OAUTH_CONFIG = Symbol('GOOGLE_OAUTH_CONFIG');

export function loadGoogleOAuthConfig(
  env: Record<string, string | undefined> = process.env,
): GoogleOAuthConfig {
  return {
    clientId: env.GOOGLE_CLIENT_ID || 'mock-google-client-id.apps.googleusercontent.com',
    clientSecret: env.GOOGLE_CLIENT_SECRET || 'mock-google-client-secret',
    callbackUrl: env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback',
  };
}
