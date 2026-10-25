export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface RefreshTokenRecord {
  id: string;
  accountId: string;
  tokenHash: string;
  familyId: string;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface RefreshTokenRepository {
  save(record: {
    id: string;
    accountId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revoke(id: string, revokedAt: Date): Promise<void>;
  revokeAllForAccount(accountId: string, revokedAt: Date): Promise<void>;
}
