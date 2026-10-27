import {
  formatTaskReminderNotification,
  formatClassSessionReminderNotification,
} from '../../../src/domain/reminder/reminder-template';

describe('Reminder Template', () => {
  describe('Task Reminder Template', () => {
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

  describe('Class Session Reminder Template', () => {
    const sessionWithAll = {
      id: 'session-xyz',
      date: '2026-10-27',
      startTime: '07:30',
      subject: 'Toán học',
      grade: '10A',
      room: 'P.302',
    };

    it('formats notification in Vietnamese with grade and room', () => {
      const payload = formatClassSessionReminderNotification('vi', sessionWithAll);

      expect(payload).toEqual({
        title: 'Tiết dạy',
        body: 'Toán học - 10A, 07:30, P.302',
        url: '/timetable?date=2026-10-27',
        data: {
          type: 'class_session',
          id: 'session-xyz',
          date: '2026-10-27',
          url: '/timetable?date=2026-10-27',
        },
      });
    });

    it('formats notification in English with grade and room', () => {
      const payload = formatClassSessionReminderNotification('en', {
        ...sessionWithAll,
        subject: 'Mathematics',
        room: 'Room 302',
      });

      expect(payload).toEqual({
        title: 'Class session',
        body: 'Mathematics - 10A, 07:30, Room 302',
        url: '/timetable?date=2026-10-27',
        data: {
          type: 'class_session',
          id: 'session-xyz',
          date: '2026-10-27',
          url: '/timetable?date=2026-10-27',
        },
      });
    });

    it('omits grade when not provided', () => {
      const payload = formatClassSessionReminderNotification('vi', {
        id: 'session-no-grade',
        date: '2026-10-27',
        startTime: '08:30',
        subject: 'Vật lý',
        room: 'P.101',
      });

      expect(payload.title).toBe('Tiết dạy');
      expect(payload.body).toBe('Vật lý, 08:30, P.101');
    });

    it('omits room when not provided', () => {
      const payload = formatClassSessionReminderNotification('vi', {
        id: 'session-no-room',
        date: '2026-10-27',
        startTime: '09:30',
        subject: 'Hóa học',
        grade: '11B',
      });

      expect(payload.title).toBe('Tiết dạy');
      expect(payload.body).toBe('Hóa học - 11B, 09:30');
    });

    it('handles session with only subject and startTime', () => {
      const payload = formatClassSessionReminderNotification('vi', {
        id: 'session-minimal',
        date: '2026-10-27',
        startTime: '10:30',
        subject: 'Sinh học',
      });

      expect(payload.title).toBe('Tiết dạy');
      expect(payload.body).toBe('Sinh học, 10:30');
    });

    it('defaults to Vietnamese if unknown locale provided', () => {
      const payload = formatClassSessionReminderNotification('de', sessionWithAll);
      expect(payload.title).toBe('Tiết dạy');
    });
  });
});
