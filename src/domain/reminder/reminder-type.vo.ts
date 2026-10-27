export const REMINDER_TYPES = ['task', 'class_session'] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

export function isReminderType(value: unknown): value is ReminderType {
  return typeof value === 'string' && (REMINDER_TYPES as readonly string[]).includes(value);
}
