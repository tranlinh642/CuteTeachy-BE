import { SentReminder as PrismaSentReminder } from '@prisma/client';
import { SentReminder } from '../../../../domain/reminder/sent-reminder.entity';
import { ReminderType } from '../../../../domain/reminder/reminder-type.vo';

export class SentReminderMapper {
  static toDomain(raw: PrismaSentReminder): SentReminder {
    return SentReminder.reconstitute({
      id: raw.id,
      type: raw.type as ReminderType,
      targetId: raw.targetId,
      remindAt: raw.remindAt,
      sentAt: raw.sentAt,
      accountId: raw.accountId,
    });
  }

  static toPrismaCreate(entity: SentReminder) {
    return {
      id: entity.id,
      type: entity.type,
      targetId: entity.targetId,
      remindAt: entity.remindAt,
      sentAt: entity.sentAt,
      accountId: entity.accountId,
    };
  }
}
