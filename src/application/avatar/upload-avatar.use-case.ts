import { AccountRepository } from '../account/ports/account.repository.port';
import { AvatarRepository } from './ports/avatar.repository.port';
import { ObjectStorage } from './ports/object-storage.port';
import { IdGenerator } from '../shared/ports/id-generator.port';
import { validateAvatarFile } from '../../domain/avatar/avatar-file.validator';
import { UnauthorizedError } from '../../domain/account/account.errors';
import { toUserDto, UserDto } from '../account/account.dto';

export interface UploadAvatarInput {
  accountId: string;
  file: {
    buffer: Buffer;
    size: number;
  };
}

export class UploadAvatarUseCase {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly avatarRepo: AvatarRepository,
    private readonly storage: ObjectStorage,
    private readonly idGenerator: IdGenerator,
    private readonly bucket = 'avatars',
  ) {}

  async execute(input: UploadAvatarInput): Promise<UserDto> {
    const { extension, mimeType } = validateAvatarFile(input.file.buffer, input.file.size);

    const account = await this.accountRepo.findById(input.accountId);
    if (!account) {
      throw new UnauthorizedError();
    }

    const objectKey = `${this.idGenerator.next()}.${extension}`;

    await this.storage.putObject({
      bucket: this.bucket,
      key: objectKey,
      body: input.file.buffer,
      contentType: mimeType,
    });

    const publicUrl = this.storage.getPublicUrl(this.bucket, objectKey);

    // If existing avatar was managed by system (has avatarKey), delete it from storage
    const oldAvatarKey = account.profile.avatarKey;
    if (oldAvatarKey) {
      try {
        await this.storage.deleteObject(this.bucket, oldAvatarKey);
      } catch {
        // Log or silently ignore error on old avatar deletion to not fail the upload
      }
    }

    const updatedAccount = await this.avatarRepo.updateAvatar(input.accountId, {
      avatarUrl: publicUrl,
      avatarKey: objectKey,
    });

    return toUserDto(updatedAccount);
  }
}
