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

export interface ClassSessionReminderNotificationPayload {
  title: string;
  body: string;
  url: string;
  data: {
    type: 'class_session';
    id: string;
    date: string;
    url: string;
    [key: string]: unknown;
  };
}

export function formatClassSessionReminderNotification(
  locale: string | undefined,
  session: {
    id: string;
    date: string;
    startTime: string;
    subject: string;
    grade?: string | null;
    room?: string | null;
  },
): ClassSessionReminderNotificationPayload {
  const isEn = locale === 'en';
  const title = isEn ? 'Class session' : 'Tiết dạy';
  const url = `/timetable?date=${encodeURIComponent(session.date)}`;

  const subjectPart =
    session.grade && session.grade.trim()
      ? `${session.subject} - ${session.grade.trim()}`
      : session.subject;

  const parts = [subjectPart, session.startTime];
  if (session.room && session.room.trim()) {
    parts.push(session.room.trim());
  }

  return {
    title,
    body: parts.join(', '),
    url,
    data: {
      type: 'class_session',
      id: session.id,
      date: session.date,
      url,
    },
  };
}
