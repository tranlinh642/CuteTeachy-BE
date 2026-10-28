import {
  AccessTokenPayload,
  GeneratedRefreshToken,
  GeneratedToken,
  TokenService,
} from '../../src/application/account/ports/token.service.port';
import { UnauthorizedError } from '../../src/domain/account/account.errors';

export class FakeTokenService implements TokenService {
  private count = 0;

  async createAccessToken(payload: AccessTokenPayload): Promise<GeneratedToken> {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    return {
      token: `access_token_${payload.sub}`,
      expiresAt,
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    if (token.startsWith('access_token_')) {
      return { sub: token.replace('access_token_', '') };
    }
    throw new UnauthorizedError('Invalid access token');
  }

  async createRefreshToken(remember?: boolean): Promise<GeneratedRefreshToken> {
    this.count++;
    const token = `refresh_raw_${this.count}`;
    const ttlMs = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    return {
      token,
      tokenHash: this.hashRefreshToken(token),
      expiresAt: new Date(Date.now() + ttlMs),
    };
  }

  hashRefreshToken(token: string): string {
    return `hash_of_${token}`;
  }
}
