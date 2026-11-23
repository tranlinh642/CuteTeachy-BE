import { ScheduleCategory } from '../timetable/schedule-category.vo';

export interface TaskReminderNotificationPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  data: {
    type: 'task';
    id: string;
    date: string;
    url: string;
    remindAt?: string;
    [key: string]: unknown;
  };
}

export function formatTaskReminderNotification(
  locale: string | undefined,
  task: { id: string; title: string; time: string; date: string; remindAt?: Date },
  remindAt?: Date,
): TaskReminderNotificationPayload {
  const isEn = locale === 'en';
  const prefix = isEn ? 'Task reminder' : 'Nhắc nhở công việc';
  const url = `/tasks?date=${encodeURIComponent(task.date)}`;
  const effectiveRemindAt = remindAt ?? task.remindAt;

  return {
    title: `${prefix}: ${task.title}`,
    body: task.time,
    url,
    ...(effectiveRemindAt ? { tag: `task-${task.id}-${effectiveRemindAt.getTime()}` } : {}),
    data: {
      type: 'task',
      id: task.id,
      date: task.date,
      url,
      ...(effectiveRemindAt ? { remindAt: effectiveRemindAt.toISOString() } : {}),
    },
  };
}

export interface ClassSessionReminderNotificationPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  data: {
    type: 'class_session';
    id: string;
    date: string;
    url: string;
    remindAt?: string;
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
    category?: ScheduleCategory | null;
    remindAt?: Date;
  },
  remindAt?: Date,
): ClassSessionReminderNotificationPayload {
  const isEn = locale === 'en';
  const category = session.category ?? 'school_teaching';
  let prefix: string;
  if (category === 'extra_teaching') {
    prefix = isEn ? 'Extra tutoring' : 'Ca dạy thêm';
  } else if (category === 'self_study') {
    prefix = isEn ? 'Study session' : 'Lịch học';
  } else {
    prefix = isEn ? 'Class session' : 'Tiết dạy';
  }
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
  const effectiveRemindAt = remindAt ?? session.remindAt;

  return {
    title,
    body,
    url,
    ...(effectiveRemindAt
      ? { tag: `class_session-${session.id}-${effectiveRemindAt.getTime()}` }
      : {}),
    data: {
      type: 'class_session',
      id: session.id,
      date: session.date,
      url,
      ...(effectiveRemindAt ? { remindAt: effectiveRemindAt.toISOString() } : {}),
    },
  };
}

export interface NoteReminderNotificationPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  data: {
    type: 'note';
    id: string;
    date: string;
    url: string;
    remindAt?: string;
    [key: string]: unknown;
  };
}

export function formatNoteReminderNotification(
  locale: string | undefined,
  note: {
    id: string;
    title: string;
    dueDate: string;
    remindTime?: string | null;
    remindAt?: Date;
  },
  remindAt?: Date,
): NoteReminderNotificationPayload {
  const isEn = locale === 'en';
  const prefix = isEn ? 'Note reminder' : 'Nhắc nhở ghi chú';
  const url = `/notes?noteId=${encodeURIComponent(note.id)}`;
  const effectiveTime =
    note.remindTime && note.remindTime.trim() !== '' ? note.remindTime.trim() : '07:00';
  const normalizedDate = note.dueDate.slice(0, 10);
  const effectiveRemindAt = remindAt ?? note.remindAt;

  return {
    title: `${prefix}: ${note.title}`,
    body: effectiveTime,
    url,
    ...(effectiveRemindAt ? { tag: `note-${note.id}-${effectiveRemindAt.getTime()}` } : {}),
    data: {
      type: 'note',
      id: note.id,
      date: normalizedDate,
      url,
      ...(effectiveRemindAt ? { remindAt: effectiveRemindAt.toISOString() } : {}),
    },
  };
}
