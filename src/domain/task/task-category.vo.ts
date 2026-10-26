export const TASK_CATEGORIES = ['school', 'personal'] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export function isTaskCategory(value: unknown): value is TaskCategory {
  return typeof value === 'string' && (TASK_CATEGORIES as readonly string[]).includes(value);
}
