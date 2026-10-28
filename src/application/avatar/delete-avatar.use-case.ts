import { AccountRepository } from '../account/ports/account.repository.port';
import { AvatarRepository } from './ports/avatar.repository.port';
import { ObjectStorage } from './ports/object-storage.port';
import { UnauthorizedError } from '../../domain/account/account.errors';
import { toUserDto, UserDto } from '../account/account.dto';

export interface DeleteAvatarInput {
  accountId: string;
}

export class DeleteAvatarUseCase {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly avatarRepo: AvatarRepository,
    private readonly storage: ObjectStorage,
    private readonly bucket = 'avatars',
  ) {}

  async execute(input: DeleteAvatarInput): Promise<UserDto> {
    const account = await this.accountRepo.findById(input.accountId);
    if (!account) {
      throw new UnauthorizedError();
    }

    const oldAvatarKey = account.profile.avatarKey;
    if (oldAvatarKey) {
      try {
        await this.storage.deleteObject(this.bucket, oldAvatarKey);
      } catch {
        // Silently ignore or continue if already deleted
      }
    }

    const updatedAccount = await this.avatarRepo.updateAvatar(input.accountId, {
      avatarUrl: null,
      avatarKey: null,
    });

    return toUserDto(updatedAccount);
  }
}
