import type { InAppNotification } from '../../../domain/notification/in-app-notification.entity';

export const IN_APP_NOTIFICATION_REPOSITORY = Symbol('IN_APP_NOTIFICATION_REPOSITORY');

export interface FindInAppNotificationsOptions {
  unreadOnly?: boolean;
  limit?: number;
}

export interface InAppNotificationRepository {
  save(notification: InAppNotification): Promise<void>;
  findById(id: string): Promise<InAppNotification | null>;
  findByAccountId(
    accountId: string,
    options?: FindInAppNotificationsOptions,
  ): Promise<InAppNotification[]>;
  countUnreadByAccountId(accountId: string): Promise<number>;
  markAllReadByAccountId(accountId: string, readAt: Date): Promise<number>;
  deletePermanentlyBefore(threshold: Date): Promise<number>;
}
