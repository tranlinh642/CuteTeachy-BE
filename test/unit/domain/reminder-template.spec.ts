import { formatTaskReminderNotification } from '../../../src/domain/reminder/reminder-template';

describe('Reminder Template', () => {
  const task = {
    id: 'task-abc',
    title: 'Soạn giáo án Ngữ văn 10',
    time: '08:30',
    date: '2026-10-27',
  };

  it('formats notification in Vietnamese (vi)', () => {
    const payload = formatTaskReminderNotification('vi', task);

    expect(payload).toEqual({
      title: 'Nhắc nhở công việc: Soạn giáo án Ngữ văn 10',
      body: '08:30',
      url: '/tasks?date=2026-10-27',
      data: {
        type: 'task',
        id: 'task-abc',
        date: '2026-10-27',
        url: '/tasks?date=2026-10-27',
      },
    });
  });

  it('formats notification in English (en)', () => {
    const payload = formatTaskReminderNotification('en', {
      ...task,
      title: 'Lesson plan prep',
    });

    expect(payload).toEqual({
      title: 'Task reminder: Lesson plan prep',
      body: '08:30',
      url: '/tasks?date=2026-10-27',
      data: {
        type: 'task',
        id: 'task-abc',
        date: '2026-10-27',
        url: '/tasks?date=2026-10-27',
      },
    });
  });

  it('defaults to Vietnamese if unknown locale provided', () => {
    const payload = formatTaskReminderNotification('fr', task);
    expect(payload.title).toBe('Nhắc nhở công việc: Soạn giáo án Ngữ văn 10');
  });
});
