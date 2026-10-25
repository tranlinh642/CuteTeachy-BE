import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  GoogleOAuthClient,
  GoogleUserInfo,
} from '../../application/google-auth/ports/google-oauth.client.port';
import {
  GOOGLE_OAUTH_CONFIG,
  GoogleOAuthConfig,
  loadGoogleOAuthConfig,
} from './google-oauth.config';

@Injectable()
export class GoogleOAuthClientImpl implements GoogleOAuthClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;

  constructor(
    @Optional()
    @Inject(GOOGLE_OAUTH_CONFIG)
    config?: GoogleOAuthConfig,
  ) {
    const resolvedConfig = config ?? loadGoogleOAuthConfig();
    this.clientId = resolvedConfig.clientId;
    this.clientSecret = resolvedConfig.clientSecret;
    this.callbackUrl = resolvedConfig.callbackUrl;
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async getUserInfo(code: string): Promise<GoogleUserInfo> {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to exchange Google OAuth code: ${tokenResponse.statusText}`);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      id_token?: string;
    };
    if (!tokenData.access_token) {
      throw new Error('Google OAuth token response missing access_token');
    }

    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to fetch Google user info: ${userResponse.statusText}`);
    }

    const data = (await userResponse.json()) as {
      sub: string;
      email: string;
      email_verified?: boolean | string;
      name?: string;
      given_name?: string;
      picture?: string;
    };

    return {
      sub: data.sub,
      email: data.email,
      emailVerified: data.email_verified === true || data.email_verified === 'true',
      name: data.name,
      givenName: data.given_name,
      picture: data.picture,
    };
  }
}
