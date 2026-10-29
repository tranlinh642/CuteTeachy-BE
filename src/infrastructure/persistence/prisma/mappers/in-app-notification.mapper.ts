import { InAppNotification as PrismaInAppNotification, Prisma } from '@prisma/client';
import { InAppNotification } from '../../../../domain/notification/in-app-notification.entity';
import { InAppNotificationType } from '../../../../domain/notification/in-app-notification-type.vo';

export class InAppNotificationMapper {
  static toDomain(raw: PrismaInAppNotification): InAppNotification {
    const data =
      raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
        ? (raw.data as Record<string, unknown>)
        : null;

    return InAppNotification.reconstitute({
      id: raw.id,
      accountId: raw.accountId,
      type: raw.type as InAppNotificationType,
      targetId: raw.targetId,
      title: raw.title,
      body: raw.body,
      url: raw.url,
      data,
      readAt: raw.readAt,
      createdAt: raw.createdAt,
    });
  }

  static toPrismaCreate(entity: InAppNotification): Prisma.InAppNotificationUncheckedCreateInput {
    return {
      id: entity.id,
      accountId: entity.accountId,
      type: entity.type,
      targetId: entity.targetId,
      title: entity.title,
      body: entity.body,
      url: entity.url,
      data: entity.data ? (entity.data as Prisma.InputJsonValue) : Prisma.JsonNull,
      readAt: entity.readAt,
      createdAt: entity.createdAt,
    };
  }

  static toPrismaUpdate(entity: InAppNotification): Prisma.InAppNotificationUncheckedUpdateInput {
    return {
      readAt: entity.readAt,
    };
  }
}
