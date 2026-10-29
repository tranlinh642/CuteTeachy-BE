import {
  NotificationNotFoundError,
  NotificationValidationError,
} from '../../domain/notification/notification.errors';
import { Clock } from '../shared/ports/clock.port';
import { InAppNotificationDto, toInAppNotificationDto } from './notification.dto';
import { InAppNotificationRepository } from './ports/in-app-notification.repository.port';

export interface MarkInAppNotificationReadInput {
  id: string;
  accountId: string;
}

export class MarkInAppNotificationReadUseCase {
  constructor(
    private readonly notificationRepo: InAppNotificationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: MarkInAppNotificationReadInput): Promise<InAppNotificationDto> {
    if (!input.id || typeof input.id !== 'string' || !input.id.trim()) {
      throw new NotificationValidationError('id is required');
    }
    if (!input.accountId || typeof input.accountId !== 'string' || !input.accountId.trim()) {
      throw new NotificationValidationError('accountId is required');
    }

    const existing = await this.notificationRepo.findById(input.id.trim());
    if (!existing || existing.accountId !== input.accountId.trim()) {
      throw new NotificationNotFoundError('Notification not found');
    }

    if (existing.readAt === null) {
      existing.markRead(this.clock.now());
      await this.notificationRepo.save(existing);
    }

    return toInAppNotificationDto(existing);
  }
}
