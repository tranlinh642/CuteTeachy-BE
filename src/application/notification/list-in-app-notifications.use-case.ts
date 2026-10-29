import { NotificationValidationError } from '../../domain/notification/notification.errors';
import { InAppNotificationDto, toInAppNotificationDto } from './notification.dto';
import { InAppNotificationRepository } from './ports/in-app-notification.repository.port';

export interface ListInAppNotificationsInput {
  accountId: string;
  unreadOnly?: boolean;
  limit?: number;
}

export interface ListInAppNotificationsOutput {
  items: InAppNotificationDto[];
  unreadCount: number;
}

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export class ListInAppNotificationsUseCase {
  constructor(private readonly notificationRepo: InAppNotificationRepository) {}

  async execute(input: ListInAppNotificationsInput): Promise<ListInAppNotificationsOutput> {
    if (!input.accountId || typeof input.accountId !== 'string' || !input.accountId.trim()) {
      throw new NotificationValidationError('accountId is required');
    }

    const accountId = input.accountId.trim();
    const limit =
      input.limit !== undefined && Number.isFinite(input.limit) && input.limit > 0
        ? Math.min(Math.floor(input.limit), MAX_LIMIT)
        : DEFAULT_LIMIT;
    const unreadOnly = input.unreadOnly === true;

    const [entities, unreadCount] = await Promise.all([
      this.notificationRepo.findByAccountId(accountId, { unreadOnly, limit }),
      this.notificationRepo.countUnreadByAccountId(accountId),
    ]);

    return {
      items: entities.map(toInAppNotificationDto),
      unreadCount,
    };
  }
}
