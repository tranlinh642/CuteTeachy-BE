import type { SentReminder } from '../../../domain/reminder/sent-reminder.entity';
import type { ReminderType } from '../../../domain/reminder/reminder-type.vo';

export const SENT_REMINDER_REPOSITORY = Symbol('SENT_REMINDER_REPOSITORY');

export interface SentReminderRepository {
  save(reminder: SentReminder): Promise<void>;
  exists(type: ReminderType, targetId: string, remindAt: Date): Promise<boolean>;
  deletePermanentlyBefore(threshold: Date): Promise<number>;
}
