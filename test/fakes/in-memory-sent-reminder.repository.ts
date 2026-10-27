import { SentReminderRepository } from '../../src/application/reminder/ports/sent-reminder.repository.port';
import { SentReminder } from '../../src/domain/reminder/sent-reminder.entity';
import { ReminderType } from '../../src/domain/reminder/reminder-type.vo';

export class InMemorySentReminderRepository implements SentReminderRepository {
  private readonly items = new Map<string, SentReminder>();

  private makeKey(type: ReminderType, targetId: string, remindAt: Date): string {
    return `${type}:${targetId}:${remindAt.toISOString()}`;
  }

  async save(reminder: SentReminder): Promise<void> {
    const key = this.makeKey(reminder.type, reminder.targetId, reminder.remindAt);
    this.items.set(key, reminder);
  }

  async exists(type: ReminderType, targetId: string, remindAt: Date): Promise<boolean> {
    const key = this.makeKey(type, targetId, remindAt);
    return this.items.has(key);
  }

  async deletePermanentlyBefore(threshold: Date): Promise<number> {
    let deleted = 0;
    for (const [key, item] of this.items.entries()) {
      if (item.sentAt.getTime() < threshold.getTime()) {
        this.items.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  getAll(): SentReminder[] {
    return Array.from(this.items.values());
  }

  clear(): void {
    this.items.clear();
  }
}
