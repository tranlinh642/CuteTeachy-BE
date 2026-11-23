import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  FindInAppNotificationsOptions,
  InAppNotificationRepository,
} from '../../../../application/notification/ports/in-app-notification.repository.port';
import { InAppNotification } from '../../../../domain/notification/in-app-notification.entity';
import { InAppNotificationMapper } from '../mappers/in-app-notification.mapper';

@Injectable()
export class PrismaInAppNotificationRepository implements InAppNotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(notification: InAppNotification): Promise<void> {
    const createData = InAppNotificationMapper.toPrismaCreate(notification);
    const updateData = InAppNotificationMapper.toPrismaUpdate(notification);

    await this.prisma.inAppNotification.upsert({
      where: { id: notification.id },
      create: createData,
      update: updateData,
    });
  }

  async findById(id: string): Promise<InAppNotification | null> {
    const raw = await this.prisma.inAppNotification.findUnique({
      where: { id },
    });
    return raw ? InAppNotificationMapper.toDomain(raw) : null;
  }

  async findByAccountId(
    accountId: string,
    options?: FindInAppNotificationsOptions,
  ): Promise<InAppNotification[]> {
    const unreadOnly = options?.unreadOnly === true;
    const limit = options?.limit ?? 30;

    const rows = await this.prisma.inAppNotification.findMany({
      where: {
        accountId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    return rows.map(InAppNotificationMapper.toDomain);
  }

  async countUnreadByAccountId(accountId: string): Promise<number> {
    return this.prisma.inAppNotification.count({
      where: {
        accountId,
        readAt: null,
      },
    });
  }

  async markAllReadByAccountId(accountId: string, readAt: Date): Promise<number> {
    const result = await this.prisma.inAppNotification.updateMany({
      where: {
        accountId,
        readAt: null,
      },
      data: {
        readAt,
      },
    });
    return result.count;
  }

  async deletePermanentlyBefore(threshold: Date): Promise<number> {
    const result = await this.prisma.inAppNotification.deleteMany({
      where: {
        createdAt: {
          lt: threshold,
        },
      },
    });
    return result.count;
  }
}
