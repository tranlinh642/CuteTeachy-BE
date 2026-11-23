export const SCHEDULE_CATEGORIES = [
  'school_teaching',
  'extra_teaching',
  'self_study',
] as const;

export type ScheduleCategory = (typeof SCHEDULE_CATEGORIES)[number];

export const DEFAULT_SCHEDULE_CATEGORY: ScheduleCategory = 'school_teaching';

export function isScheduleCategory(value: unknown): value is ScheduleCategory {
  return (
    typeof value === 'string' &&
    (SCHEDULE_CATEGORIES as readonly string[]).includes(value)
  );
}
