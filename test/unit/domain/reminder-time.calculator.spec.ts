import {
  calculateTaskRemindAt,
  parseZonedTimeToUtc,
} from '../../../src/domain/reminder/reminder-time.calculator';
import { ReminderValidationError } from '../../../src/domain/reminder/reminder.errors';

describe('Reminder Time Calculator', () => {
  describe('parseZonedTimeToUtc', () => {
    it('correctly converts local date/time in Asia/Ho_Chi_Minh (UTC+7) to UTC', () => {
      // 2026-10-27 15:30 in Asia/Ho_Chi_Minh is 08:30 UTC
      const utc = parseZonedTimeToUtc('2026-10-27', '15:30', 'Asia/Ho_Chi_Minh');
      expect(utc.toISOString()).toBe('2026-10-27T08:30:00.000Z');
    });

    it('correctly converts local date/time in UTC', () => {
      const utc = parseZonedTimeToUtc('2026-10-27', '10:00', 'UTC');
      expect(utc.toISOString()).toBe('2026-10-27T10:00:00.000Z');
    });

    it('correctly converts local date/time in America/New_York (EDT UTC-4 in October)', () => {
      // 2026-10-27 10:00 in America/New_York is 14:00 UTC
      const utc = parseZonedTimeToUtc('2026-10-27', '10:00', 'America/New_York');
      expect(utc.toISOString()).toBe('2026-10-27T14:00:00.000Z');
    });

    it('throws validation error on invalid date format', () => {
      expect(() => parseZonedTimeToUtc('2026/10/27', '10:00', 'UTC')).toThrow(
        ReminderValidationError,
      );
    });

    it('throws validation error on invalid time format', () => {
      expect(() => parseZonedTimeToUtc('2026-10-27', '25:00', 'UTC')).toThrow(
        ReminderValidationError,
      );
    });

    it('throws validation error on invalid timezone', () => {
      expect(() => parseZonedTimeToUtc('2026-10-27', '10:00', 'Invalid/Timezone')).toThrow(
        ReminderValidationError,
      );
    });
  });

  describe('calculateTaskRemindAt', () => {
    it('subtracts leadMinutes from task start time', () => {
      // Task at 2026-10-27 10:00 Asia/Ho_Chi_Minh -> start UTC is 03:00:00.000Z
      // Lead 15 min -> remindAt is 02:45:00.000Z
      const remindAt = calculateTaskRemindAt('2026-10-27', '10:00', 'Asia/Ho_Chi_Minh', 15);
      expect(remindAt.toISOString()).toBe('2026-10-27T02:45:00.000Z');
    });

    it('handles leadMinutes = 60', () => {
      // Task at 2026-10-27 10:00 Asia/Ho_Chi_Minh -> start UTC is 03:00:00.000Z
      // Lead 60 min -> remindAt is 02:00:00.000Z
      const remindAt = calculateTaskRemindAt('2026-10-27', '10:00', 'Asia/Ho_Chi_Minh', 60);
      expect(remindAt.toISOString()).toBe('2026-10-27T02:00:00.000Z');
    });

    it('handles date boundary crossings when lead time pushes to previous day UTC', () => {
      // Task at 2026-10-27 00:05 UTC -> lead 15 min -> 2026-10-26 23:50 UTC
      const remindAt = calculateTaskRemindAt('2026-10-27', '00:05', 'UTC', 15);
      expect(remindAt.toISOString()).toBe('2026-10-26T23:50:00.000Z');
    });

    it('throws validation error if leadMinutes is negative or not allowed', () => {
      expect(() => calculateTaskRemindAt('2026-10-27', '10:00', 'UTC', -5)).toThrow(
        ReminderValidationError,
      );
    });
  });
});
