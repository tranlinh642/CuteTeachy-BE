import { ReminderValidationError } from './reminder.errors';
import { isValidIanaTimeZone } from '../settings/settings.types';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function parseZonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  if (!dateStr || !DATE_REGEX.test(dateStr)) {
    throw new ReminderValidationError(`Invalid date format (expected YYYY-MM-DD): ${dateStr}`);
  }

  if (!timeStr || !TIME_REGEX.test(timeStr)) {
    throw new ReminderValidationError(`Invalid time format (expected HH:mm): ${timeStr}`);
  }

  if (!isValidIanaTimeZone(timeZone)) {
    throw new ReminderValidationError(`Invalid IANA time zone: ${timeZone}`);
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const guessUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  function getOffset(utcMs: number): number {
    const parts = formatter.formatToParts(new Date(utcMs));
    let y = 0,
      m = 0,
      d = 0,
      h = 0,
      min = 0,
      s = 0;
    for (const part of parts) {
      if (part.type === 'year') y = Number(part.value);
      else if (part.type === 'month') m = Number(part.value);
      else if (part.type === 'day') d = Number(part.value);
      else if (part.type === 'hour') h = part.value === '24' ? 0 : Number(part.value);
      else if (part.type === 'minute') min = Number(part.value);
      else if (part.type === 'second') s = Number(part.value);
    }
    const localMs = Date.UTC(y, m - 1, d, h, min, s);
    return localMs - utcMs;
  }

  const offset = getOffset(guessUtc);
  const utcTime = guessUtc - offset;
  const offset2 = getOffset(utcTime);
  return new Date(guessUtc - offset2);
}

export function calculateTaskRemindAt(
  dateStr: string,
  timeStr: string,
  timeZone: string,
  leadMinutes: number,
): Date {
  if (typeof leadMinutes !== 'number' || isNaN(leadMinutes) || leadMinutes < 0) {
    throw new ReminderValidationError(`Invalid reminderLeadMinutes: ${leadMinutes}`);
  }

  const taskStartUtc = parseZonedTimeToUtc(dateStr, timeStr, timeZone);
  return new Date(taskStartUtc.getTime() - leadMinutes * 60 * 1000);
}

export function calculateClassSessionRemindAt(
  dateStr: string,
  startTimeStr: string,
  timeZone: string,
  leadMinutes: number,
): Date {
  return calculateTaskRemindAt(dateStr, startTimeStr, timeZone, leadMinutes);
}
