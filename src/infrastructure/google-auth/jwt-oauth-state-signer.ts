import { Inject, Injectable, Optional } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import {
  OAuthStatePayload,
  OAuthStateSigner,
} from '../../application/google-auth/ports/oauth-state-signer.port';
import { APP_CONFIG, AppConfig } from '../config/app.config';

@Injectable()
export class JwtOAuthStateSigner implements OAuthStateSigner {
  private readonly secret: string;
  private readonly expiresIn: string | number;

  constructor(
    @Inject(APP_CONFIG) configOrSecret: AppConfig | string,
    @Optional() expiresIn?: string | number,
  ) {
    this.secret =
      typeof configOrSecret === 'string'
        ? configOrSecret
        : configOrSecret.JWT_SECRET;
    this.expiresIn = expiresIn ?? '10m';
  }

  sign(payload: OAuthStatePayload): string {
    return jwt.sign(
      { remember: payload.remember, nonce: payload.nonce },
      this.secret,
      { expiresIn: this.expiresIn as any },
    );
  }

  verify(token: string): OAuthStatePayload | null {
    if (!token || typeof token !== 'string') {
      return null;
    }
    try {
      const decoded = jwt.verify(token, this.secret) as {
        remember?: boolean;
        nonce?: string;
      };
      if (typeof decoded.remember !== 'boolean' || typeof decoded.nonce !== 'string') {
        return null;
      }
      return {
        remember: decoded.remember,
        nonce: decoded.nonce,
      };
    } catch {
      return null;
    }
  }
}
