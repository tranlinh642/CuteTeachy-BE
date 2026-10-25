import { Account } from '../../../domain/account/account.entity';
import { Profile } from '../../../domain/account/profile.entity';

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

export interface AccountRepository {
  findByEmail(email: string): Promise<Account | null>;
  findById(id: string): Promise<Account | null>;
  createWithPassword(account: Account, passwordHash: string): Promise<void>;
  getPasswordHash(accountId: string): Promise<string | null>;
  updateProfile(profile: Profile): Promise<void>;
  markEmailVerified(accountId: string, verifiedAt: Date): Promise<void>;
  updatePassword(accountId: string, passwordHash: string): Promise<void>;
}
