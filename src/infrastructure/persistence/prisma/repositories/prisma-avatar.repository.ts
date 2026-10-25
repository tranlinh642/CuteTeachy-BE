import { Injectable } from '@nestjs/common';
import {
  AvatarRepository,
  AvatarUpdateData,
} from '../../../../application/avatar/ports/avatar.repository.port';
import { Account } from '../../../../domain/account/account.entity';
import { PrismaService } from '../prisma.service';
import { AccountMapper } from '../mappers/account.mapper';

@Injectable()
export class PrismaAvatarRepository implements AvatarRepository {
  constructor(private readonly prisma: PrismaService) {}

  async updateAvatar(accountId: string, data: AvatarUpdateData): Promise<Account> {
    await this.prisma.profile.update({
      where: { accountId },
      data: {
        avatarUrl: data.avatarUrl,
        avatarKey: data.avatarKey,
      },
    });

    const account = await this.prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      include: {
        loginProviders: true,
        profile: true,
      },
    });

    return AccountMapper.toDomain(account);
  }
}
