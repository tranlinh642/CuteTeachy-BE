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
  const prefix = isEn ? 'Class session' : 'Tiết dạy';
  const grade = session.grade ? session.grade.trim() : '';
  const title = grade ? `${prefix}: ${session.subject} ${grade}` : `${prefix}: ${session.subject}`;

  const room = session.room ? session.room.trim() : '';
  let body: string;
  if (isEn) {
    if (room) {
      const roomStr = /^room\b/i.test(room) ? room : `Room ${room}`;
      body = `Starts at ${session.startTime} in ${roomStr}`;
    } else {
      body = `Starts at ${session.startTime}`;
    }
  } else {
    if (room) {
      const roomStr = /^(phòng|p\.)\b/i.test(room) ? room : `Phòng ${room}`;
      body = `Bắt đầu lúc ${session.startTime} tại ${roomStr}`;
    } else {
      body = `Bắt đầu lúc ${session.startTime}`;
    }
  }

  const url = `/timetable?date=${encodeURIComponent(session.date)}`;

  return {
    title,
    body,
    url,
    data: {
      type: 'class_session',
      id: session.id,
      date: session.date,
      url,
    },
  };
}
