export interface TaskReminderNotificationPayload {
  title: string;
  body: string;
  url: string;
  data: {
    type: 'task';
    id: string;
    date: string;
    url: string;
    [key: string]: unknown;
  };
}

export function formatTaskReminderNotification(
  locale: string | undefined,
  task: { id: string; title: string; time: string; date: string },
): TaskReminderNotificationPayload {
  const isEn = locale === 'en';
  const prefix = isEn ? 'Task reminder' : 'Nhắc nhở công việc';
  const url = `/tasks?date=${encodeURIComponent(task.date)}`;

  return {
    title: `${prefix}: ${task.title}`,
    body: task.time,
    url,
    data: {
      type: 'task',
      id: task.id,
      date: task.date,
      url,
    },
  };
}
