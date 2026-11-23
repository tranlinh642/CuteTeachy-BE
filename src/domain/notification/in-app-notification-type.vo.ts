export const IN_APP_NOTIFICATION_TYPES = ['task', 'class_session', 'note', 'system'] as const;

export type InAppNotificationType = (typeof IN_APP_NOTIFICATION_TYPES)[number];

export function isInAppNotificationType(value: unknown): value is InAppNotificationType {
  return (
    typeof value === 'string' &&
    (IN_APP_NOTIFICATION_TYPES as readonly string[]).includes(value)
  );
}
