import { Account } from '../../src/domain/account/account.entity';
import { Profile } from '../../src/domain/account/profile.entity';
import { AccountRepository } from '../../src/application/account/ports/account.repository.port';

export class InMemoryAccountRepository implements AccountRepository {
  private readonly accounts = new Map<string, Account>();
  private readonly passwordHashes = new Map<string, string>();

  async findByEmail(email: string): Promise<Account | null> {
    const normalized = email.trim().toLowerCase();
    for (const account of this.accounts.values()) {
      if (account.email.toLowerCase() === normalized) {
        return account;
      }
    }
    return null;
  }

  async findById(id: string): Promise<Account | null> {
    return this.accounts.get(id) ?? null;
  }

  async createWithPassword(account: Account, passwordHash: string): Promise<void> {
    this.accounts.set(account.id, account);
    this.passwordHashes.set(account.id, passwordHash);
  }

  save(account: Account): void {
    this.accounts.set(account.id, account);
  }

  async getPasswordHash(accountId: string): Promise<string | null> {
    return this.passwordHashes.get(accountId) ?? null;
  }

  async updateProfile(profile: Profile): Promise<void> {
    const existing = this.accounts.get(profile.accountId);
    if (existing) {
      const updatedAccount = Account.reconstitute({
        id: existing.id,
        email: existing.email,
        emailVerifiedAt: existing.emailVerifiedAt,
        loginProviders: existing.loginProviders,
        profile,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      });
      this.accounts.set(profile.accountId, updatedAccount);
    }
  }

  async markEmailVerified(accountId: string, verifiedAt: Date): Promise<void> {
    const existing = this.accounts.get(accountId);
    if (existing) {
      const updated = Account.reconstitute({
        id: existing.id,
        email: existing.email,
        emailVerifiedAt: verifiedAt,
        loginProviders: existing.loginProviders,
        profile: existing.profile,
        createdAt: existing.createdAt,
        updatedAt: verifiedAt,
      });
      this.accounts.set(accountId, updated);
    }
  }

  async updatePassword(accountId: string, passwordHash: string): Promise<void> {
    this.passwordHashes.set(accountId, passwordHash);
  }
}
