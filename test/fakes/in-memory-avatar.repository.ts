import { Account } from '../../src/domain/account/account.entity';
import { Profile } from '../../src/domain/account/profile.entity';
import {
  AvatarRepository,
  AvatarUpdateData,
} from '../../src/application/avatar/ports/avatar.repository.port';
import { InMemoryAccountRepository } from './in-memory-account.repository';

export class InMemoryAvatarRepository implements AvatarRepository {
  constructor(private readonly accountRepo: InMemoryAccountRepository) {}

  async updateAvatar(accountId: string, data: AvatarUpdateData): Promise<Account> {
    const existing = await this.accountRepo.findById(accountId);
    if (!existing) {
      throw new Error(`Account not found: ${accountId}`);
    }

    const updatedProfile = Profile.reconstitute({
      id: existing.profile.id,
      accountId: existing.profile.accountId,
      fullName: existing.profile.fullName,
      displayName: existing.profile.displayName,
      title: existing.profile.title,
      gender: existing.profile.gender,
      avatarUrl: data.avatarUrl ?? undefined,
      avatarKey: data.avatarKey ?? undefined,
      onboardingCompletedAt: existing.profile.onboardingCompletedAt,
      createdAt: existing.profile.createdAt,
      updatedAt: new Date(),
    });

    const updatedAccount = Account.reconstitute({
      id: existing.id,
      email: existing.email,
      emailVerifiedAt: existing.emailVerifiedAt,
      loginProviders: existing.loginProviders,
      profile: updatedProfile,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    this.accountRepo.save(updatedAccount);
    return updatedAccount;
  }
}
