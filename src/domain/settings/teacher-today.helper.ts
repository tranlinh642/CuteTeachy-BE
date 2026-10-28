import { isValidIanaTimeZone } from './settings.types';
import { SettingsValidationError } from './settings.errors';

export interface TeacherToday {
  dateString: string; // 'YYYY-MM-DD'
  year: number;
  month: number;
  day: number;
  dayOfYear: number;
}

export function calculateTeacherToday(date: Date, timeZone: string): TeacherToday {
  if (!isValidIanaTimeZone(timeZone)) {
    throw new SettingsValidationError(`Invalid IANA time zone: ${timeZone}`);
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  let yearStr = '';
  let monthStr = '';
  let dayStr = '';

  for (const part of parts) {
    if (part.type === 'year') {
      yearStr = part.value;
    } else if (part.type === 'month') {
      monthStr = part.value;
    } else if (part.type === 'day') {
      dayStr = part.value;
    }
  }

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const dateString = `${yearStr}-${monthStr}-${dayStr}`;

  const startOfYear = Date.UTC(year, 0, 1);
  const currentDate = Date.UTC(year, month - 1, day);
  const dayOfYear = Math.floor((currentDate - startOfYear) / (24 * 60 * 60 * 1000)) + 1;

  return {
    dateString,
    year,
    month,
    day,
    dayOfYear,
  };
}
