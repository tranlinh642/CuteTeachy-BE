import {
  formatTaskReminderNotification,
  formatClassSessionReminderNotification,
  formatNoteReminderNotification,
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

  describe('Class Session Reminder Template (SPEC-005 §50)', () => {
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
        title: 'Tiết dạy: Toán học 10A',
        body: 'Bắt đầu lúc 07:30 tại P.302',
        url: '/timetable?date=2026-10-27',
        data: {
          type: 'class_session',
          id: 'session-xyz',
          date: '2026-10-27',
          url: '/timetable?date=2026-10-27',
        },
      });
    });

    it('formats notification in Vietnamese with standard room number', () => {
      const payload = formatClassSessionReminderNotification('vi', {
        id: 'session-xyz',
        date: '2026-10-27',
        startTime: '07:30',
        subject: 'Toán 10A1',
        room: '102',
      });

      expect(payload.title).toBe('Tiết dạy: Toán 10A1');
      expect(payload.body).toBe('Bắt đầu lúc 07:30 tại Phòng 102');
    });

    it('formats notification in English with grade and room', () => {
      const payload = formatClassSessionReminderNotification('en', {
        ...sessionWithAll,
        subject: 'Mathematics',
        room: 'Room 302',
      });

      expect(payload).toEqual({
        title: 'Class session: Mathematics 10A',
        body: 'Starts at 07:30 in Room 302',
        url: '/timetable?date=2026-10-27',
        data: {
          type: 'class_session',
          id: 'session-xyz',
          date: '2026-10-27',
          url: '/timetable?date=2026-10-27',
        },
      });
    });

    it('formats notification in English with plain room number', () => {
      const payload = formatClassSessionReminderNotification('en', {
        id: 'session-xyz',
        date: '2026-10-27',
        startTime: '07:30',
        subject: 'Math',
        grade: '10A1',
        room: '102',
      });

      expect(payload.title).toBe('Class session: Math 10A1');
      expect(payload.body).toBe('Starts at 07:30 in Room 102');
    });

    it('omits grade when not provided', () => {
      const payload = formatClassSessionReminderNotification('vi', {
        id: 'session-no-grade',
        date: '2026-10-27',
        startTime: '08:30',
        subject: 'Vật lý',
        room: 'P.101',
      });

      expect(payload.title).toBe('Tiết dạy: Vật lý');
      expect(payload.body).toBe('Bắt đầu lúc 08:30 tại P.101');
    });

    it('omits room when not provided', () => {
      const payload = formatClassSessionReminderNotification('vi', {
        id: 'session-no-room',
        date: '2026-10-27',
        startTime: '09:30',
        subject: 'Hóa học',
        grade: '11B',
      });

      expect(payload.title).toBe('Tiết dạy: Hóa học 11B');
      expect(payload.body).toBe('Bắt đầu lúc 09:30');
    });

    it('handles session with only subject and startTime', () => {
      const payload = formatClassSessionReminderNotification('vi', {
        id: 'session-minimal',
        date: '2026-10-27',
        startTime: '10:30',
        subject: 'Sinh học',
      });

      expect(payload.title).toBe('Tiết dạy: Sinh học');
      expect(payload.body).toBe('Bắt đầu lúc 10:30');
    });

    it('defaults to Vietnamese if unknown locale provided', () => {
      const payload = formatClassSessionReminderNotification('de', sessionWithAll);
      expect(payload.title).toBe('Tiết dạy: Toán học 10A');
      expect(payload.body).toBe('Bắt đầu lúc 07:30 tại P.302');
    });
  });

  describe('Note Reminder Template (S6-BE-01)', () => {
    const note = {
      id: 'note-123',
      title: 'Nộp điểm giữa kỳ I',
      dueDate: '2026-10-27',
      remindTime: '14:30',
    };

    it('formats note notification in Vietnamese (vi) and links to /notes?noteId=<id>', () => {
      const payload = formatNoteReminderNotification('vi', note);

      expect(payload).toEqual({
        title: 'Nhắc nhở ghi chú: Nộp điểm giữa kỳ I',
        body: '14:30',
        url: '/notes?noteId=note-123',
        data: {
          type: 'note',
          id: 'note-123',
          date: '2026-10-27',
          url: '/notes?noteId=note-123',
        },
      });
    });

    it('formats note notification in English (en) and defaults body to 07:00 when remindTime is null', () => {
      const payload = formatNoteReminderNotification('en', {
        id: 'note-123',
        title: 'Submit midterm grades',
        dueDate: '2026-10-27',
        remindTime: null,
      });

      expect(payload).toEqual({
        title: 'Note reminder: Submit midterm grades',
        body: '07:00',
        url: '/notes?noteId=note-123',
        data: {
          type: 'note',
          id: 'note-123',
          date: '2026-10-27',
          url: '/notes?noteId=note-123',
        },
      });
    });
  });
});
