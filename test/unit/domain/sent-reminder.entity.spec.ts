import { SentReminder } from '../../../src/domain/reminder/sent-reminder.entity';
import { ReminderValidationError } from '../../../src/domain/reminder/reminder.errors';

describe('SentReminder Entity', () => {
  const remindAt = new Date('2026-10-27T08:15:00.000Z');
  const now = new Date('2026-10-27T08:15:01.000Z');

  describe('create', () => {
    it('creates a valid SentReminder entity', () => {
      const reminder = SentReminder.create({
        type: 'task',
        targetId: 'task-123',
        remindAt,
        accountId: 'acc-456',
        now,
      });

      expect(reminder.id).toBeDefined();
      expect(reminder.type).toBe('task');
      expect(reminder.targetId).toBe('task-123');
      expect(reminder.remindAt).toEqual(remindAt);
      expect(reminder.sentAt).toEqual(now);
      expect(reminder.accountId).toBe('acc-456');
    });

    it('rejects invalid type', () => {
      expect(() =>
        SentReminder.create({
          type: 'invalid' as any,
          targetId: 'task-123',
          remindAt,
          accountId: 'acc-456',
          now,
        }),
      ).toThrow(ReminderValidationError);
    });

    it('rejects empty targetId', () => {
      expect(() =>
        SentReminder.create({
          type: 'task',
          targetId: '   ',
          remindAt,
          accountId: 'acc-456',
          now,
        }),
      ).toThrow(ReminderValidationError);
    });

    it('rejects empty accountId', () => {
      expect(() =>
        SentReminder.create({
          type: 'task',
          targetId: 'task-123',
          remindAt,
          accountId: '',
          now,
        }),
      ).toThrow(ReminderValidationError);
    });

    it('rejects invalid remindAt', () => {
      expect(() =>
        SentReminder.create({
          type: 'task',
          targetId: 'task-123',
          remindAt: new Date('invalid'),
          accountId: 'acc-456',
          now,
        }),
      ).toThrow(ReminderValidationError);
    });
  });

  describe('reconstitute', () => {
    it('reconstitutes an existing SentReminder from persistence', () => {
      const reminder = SentReminder.reconstitute({
        id: 'sent-id-1',
        type: 'class_session',
        targetId: 'session-789',
        remindAt,
        sentAt: now,
        accountId: 'acc-456',
      });

      expect(reminder.id).toBe('sent-id-1');
      expect(reminder.type).toBe('class_session');
      expect(reminder.targetId).toBe('session-789');
      expect(reminder.remindAt).toEqual(remindAt);
      expect(reminder.sentAt).toEqual(now);
      expect(reminder.accountId).toBe('acc-456');
    });
  });
});
