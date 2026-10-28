import { Account } from '../../../domain/account/account.entity';

export const GOOGLE_AUTH_ACCOUNT_REPOSITORY = Symbol('GOOGLE_AUTH_ACCOUNT_REPOSITORY');

export interface GoogleAuthAccountRepository {
  findByProviderSubject(provider: string, subject: string): Promise<Account | null>;
  findByEmail(email: string): Promise<Account | null>;
  findById(id: string): Promise<Account | null>;
  createWithGoogle(account: Account, subject: string): Promise<void>;
  linkGoogleProvider(accountId: string, subject: string): Promise<void>;
}
