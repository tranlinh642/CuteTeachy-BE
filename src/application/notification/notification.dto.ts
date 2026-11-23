import type { InAppNotification } from '../../domain/notification/in-app-notification.entity';
import type { InAppNotificationType } from '../../domain/notification/in-app-notification-type.vo';

export interface InAppNotificationDto {
  id: string;
  accountId: string;
  type: InAppNotificationType;
  targetId: string | null;
  title: string;
  body: string;
  url: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export function toInAppNotificationDto(notification: InAppNotification): InAppNotificationDto {
  return {
    id: notification.id,
    accountId: notification.accountId,
    type: notification.type,
    targetId: notification.targetId,
    title: notification.title,
    body: notification.body,
    url: notification.url,
    data: notification.data,
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
    createdAt: notification.createdAt.toISOString(),
  };
}
