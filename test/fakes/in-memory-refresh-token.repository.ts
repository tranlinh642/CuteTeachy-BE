import {
  RefreshTokenRecord,
  RefreshTokenRepository,
} from '../../src/application/account/ports/refresh-token.repository.port';

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly tokens = new Map<string, RefreshTokenRecord>();

  async save(record: {
    id: string;
    accountId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<void> {
    this.tokens.set(record.tokenHash, {
      ...record,
      revokedAt: null,
      createdAt: new Date(),
    });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.tokens.get(tokenHash) ?? null;
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    for (const [hash, record] of this.tokens.entries()) {
      if (record.id === id) {
        this.tokens.set(hash, {
          ...record,
          revokedAt,
        });
      }
    }
  }

  async revokeAllForAccount(accountId: string, revokedAt: Date): Promise<void> {
    for (const [hash, record] of this.tokens.entries()) {
      if (record.accountId === accountId) {
        this.tokens.set(hash, {
          ...record,
          revokedAt,
        });
      }
    }
  }

  getAllTokens(): RefreshTokenRecord[] {
    return Array.from(this.tokens.values());
  }
}
