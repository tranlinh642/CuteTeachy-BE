import {
  FindInAppNotificationsOptions,
  InAppNotificationRepository,
} from '../../src/application/notification/ports/in-app-notification.repository.port';
import { InAppNotification } from '../../src/domain/notification/in-app-notification.entity';

export class InMemoryInAppNotificationRepository implements InAppNotificationRepository {
  private readonly store = new Map<string, InAppNotification>();

  async save(notification: InAppNotification): Promise<void> {
    this.store.set(
      notification.id,
      InAppNotification.reconstitute({
        id: notification.id,
        accountId: notification.accountId,
        type: notification.type,
        targetId: notification.targetId,
        title: notification.title,
        body: notification.body,
        url: notification.url,
        data: notification.data,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      }),
    );
  }

  async findById(id: string): Promise<InAppNotification | null> {
    const existing = this.store.get(id);
    if (!existing) {
      return null;
    }
    return InAppNotification.reconstitute({
      id: existing.id,
      accountId: existing.accountId,
      type: existing.type,
      targetId: existing.targetId,
      title: existing.title,
      body: existing.body,
      url: existing.url,
      data: existing.data,
      readAt: existing.readAt,
      createdAt: existing.createdAt,
    });
  }

  async findByAccountId(
    accountId: string,
    options?: FindInAppNotificationsOptions,
  ): Promise<InAppNotification[]> {
    const unreadOnly = options?.unreadOnly === true;
    const limit = options?.limit ?? 30;

    return Array.from(this.store.values())
      .filter((item) => item.accountId === accountId && (!unreadOnly || item.readAt === null))
      .sort((a, b) => {
        const diff = b.createdAt.getTime() - a.createdAt.getTime();
        if (diff !== 0) {
          return diff;
        }
        return b.id.localeCompare(a.id);
      })
      .slice(0, limit)
      .map((existing) =>
        InAppNotification.reconstitute({
          id: existing.id,
          accountId: existing.accountId,
          type: existing.type,
          targetId: existing.targetId,
          title: existing.title,
          body: existing.body,
          url: existing.url,
          data: existing.data,
          readAt: existing.readAt,
          createdAt: existing.createdAt,
        }),
      );
  }

  async countUnreadByAccountId(accountId: string): Promise<number> {
    let count = 0;
    for (const item of this.store.values()) {
      if (item.accountId === accountId && item.readAt === null) {
        count++;
      }
    }
    return count;
  }

  async markAllReadByAccountId(accountId: string, readAt: Date): Promise<number> {
    let updatedCount = 0;
    for (const [id, item] of this.store.entries()) {
      if (item.accountId === accountId && item.readAt === null) {
        item.markRead(readAt);
        this.store.set(id, item);
        updatedCount++;
      }
    }
    return updatedCount;
  }

  async deletePermanentlyBefore(threshold: Date): Promise<number> {
    let deletedCount = 0;
    for (const [id, item] of this.store.entries()) {
      if (item.createdAt.getTime() < threshold.getTime()) {
        this.store.delete(id);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  getAll(): InAppNotification[] {
    return Array.from(this.store.values()).map((existing) =>
      InAppNotification.reconstitute({
        id: existing.id,
        accountId: existing.accountId,
        type: existing.type,
        targetId: existing.targetId,
        title: existing.title,
        body: existing.body,
        url: existing.url,
        data: existing.data,
        readAt: existing.readAt,
        createdAt: existing.createdAt,
      }),
    );
  }

  clear(): void {
    this.store.clear();
  }
}
