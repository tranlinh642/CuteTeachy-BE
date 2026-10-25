import { Module } from '@nestjs/common';
import { ID_GENERATOR, IdGenerator } from '../application/shared/ports/id-generator.port';
import {
  ACCOUNT_REPOSITORY,
  AccountRepository,
} from '../application/account/ports/account.repository.port';
import { OBJECT_STORAGE, ObjectStorage } from '../application/avatar/ports/object-storage.port';
import {
  AVATAR_REPOSITORY,
  AvatarRepository,
} from '../application/avatar/ports/avatar.repository.port';
import { UploadAvatarUseCase } from '../application/avatar/upload-avatar.use-case';
import { DeleteAvatarUseCase } from '../application/avatar/delete-avatar.use-case';
import { S3ObjectStorage } from '../infrastructure/storage/s3-object-storage';
import { PrismaAvatarRepository } from '../infrastructure/persistence/prisma/repositories/prisma-avatar.repository';
import { APP_CONFIG, AppConfig } from '../infrastructure/config/app.config';
import { AvatarController } from '../presentation/http/avatar/avatar.controller';
import { AccountModule } from './account.module';

@Module({
  imports: [AccountModule],
  controllers: [AvatarController],
  providers: [
    {
      provide: OBJECT_STORAGE,
      useClass: S3ObjectStorage,
    },
    {
      provide: AVATAR_REPOSITORY,
      useClass: PrismaAvatarRepository,
    },
    {
      provide: UploadAvatarUseCase,
      useFactory: (
        accountRepo: AccountRepository,
        avatarRepo: AvatarRepository,
        storage: ObjectStorage,
        idGen: IdGenerator,
        config: AppConfig,
      ) =>
        new UploadAvatarUseCase(
          accountRepo,
          avatarRepo,
          storage,
          idGen,
          config.S3_BUCKET || config.S3_BUCKET_AVATARS || 'avatars',
        ),
      inject: [ACCOUNT_REPOSITORY, AVATAR_REPOSITORY, OBJECT_STORAGE, ID_GENERATOR, APP_CONFIG],
    },
    {
      provide: DeleteAvatarUseCase,
      useFactory: (
        accountRepo: AccountRepository,
        avatarRepo: AvatarRepository,
        storage: ObjectStorage,
        config: AppConfig,
      ) =>
        new DeleteAvatarUseCase(
          accountRepo,
          avatarRepo,
          storage,
          config.S3_BUCKET || config.S3_BUCKET_AVATARS || 'avatars',
        ),
      inject: [ACCOUNT_REPOSITORY, AVATAR_REPOSITORY, OBJECT_STORAGE, APP_CONFIG],
    },
  ],
  exports: [OBJECT_STORAGE, AVATAR_REPOSITORY, UploadAvatarUseCase, DeleteAvatarUseCase],
})
export class AvatarModule {}
