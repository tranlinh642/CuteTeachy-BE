export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export interface AccessTokenPayload {
  sub: string;
}

export interface GeneratedToken {
  token: string;
  expiresAt: Date;
}

export interface GeneratedRefreshToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface TokenService {
  createAccessToken(payload: AccessTokenPayload): Promise<GeneratedToken>;
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
  createRefreshToken(remember?: boolean): Promise<GeneratedRefreshToken>;
  hashRefreshToken(token: string): string;
}
