import type { Account } from '../../../domain/account/account.entity';

export const AVATAR_REPOSITORY = Symbol('AVATAR_REPOSITORY');

export interface AvatarUpdateData {
  avatarUrl: string | null;
  avatarKey: string | null;
}

export interface AvatarRepository {
  updateAvatar(accountId: string, data: AvatarUpdateData): Promise<Account>;
}
