export const SETTINGS_LOCALES = ['vi', 'en'] as const;
export type SettingsLocale = (typeof SETTINGS_LOCALES)[number];

export const REMINDER_LEAD_MINUTES = [5, 10, 15, 30, 60] as const;
export type ReminderLeadMinutes = (typeof REMINDER_LEAD_MINUTES)[number];

export function isSettingsLocale(val: unknown): val is SettingsLocale {
  return typeof val === 'string' && (SETTINGS_LOCALES as readonly string[]).includes(val);
}

export function isReminderLeadMinutes(val: unknown): val is ReminderLeadMinutes {
  return typeof val === 'number' && (REMINDER_LEAD_MINUTES as readonly number[]).includes(val);
}

export function isValidIanaTimeZone(val: unknown): boolean {
  if (typeof val !== 'string' || !val.trim()) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: val });
    return true;
  } catch {
    return false;
  }
}
