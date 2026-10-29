import { NotificationValidationError } from '../../domain/notification/notification.errors';
import { Clock } from '../shared/ports/clock.port';
import { InAppNotificationRepository } from './ports/in-app-notification.repository.port';

export interface MarkAllInAppNotificationsReadInput {
  accountId: string;
}

export interface MarkAllInAppNotificationsReadOutput {
  updatedCount: number;
}

export class MarkAllInAppNotificationsReadUseCase {
  constructor(
    private readonly notificationRepo: InAppNotificationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: MarkAllInAppNotificationsReadInput,
  ): Promise<MarkAllInAppNotificationsReadOutput> {
    if (!input.accountId || typeof input.accountId !== 'string' || !input.accountId.trim()) {
      throw new NotificationValidationError('accountId is required');
    }

    const updatedCount = await this.notificationRepo.markAllReadByAccountId(
      input.accountId.trim(),
      this.clock.now(),
    );

    return { updatedCount };
  }
}
