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

    it('formats prefix by ScheduleCategory (school_teaching, extra_teaching, self_study) in vi and en', () => {
      expect(
        formatClassSessionReminderNotification('vi', {
          ...sessionWithAll,
          category: 'school_teaching',
        }).title,
      ).toBe('Tiết dạy: Toán học 10A');

      expect(
        formatClassSessionReminderNotification('en', {
          ...sessionWithAll,
          subject: 'Math',
          category: 'school_teaching',
        }).title,
      ).toBe('Class session: Math 10A');

      expect(
        formatClassSessionReminderNotification('vi', {
          ...sessionWithAll,
          subject: 'Toán bồi dưỡng',
          grade: '9A',
          category: 'extra_teaching',
        }).title,
      ).toBe('Ca dạy thêm: Toán bồi dưỡng 9A');

      expect(
        formatClassSessionReminderNotification('en', {
          ...sessionWithAll,
          subject: 'Math Tutoring',
          grade: '9A',
          category: 'extra_teaching',
        }).title,
      ).toBe('Extra tutoring: Math Tutoring 9A');

      expect(
        formatClassSessionReminderNotification('vi', {
          id: 'session-study',
          date: '2026-10-27',
          startTime: '19:00',
          subject: 'IELTS Writing',
          category: 'self_study',
        }).title,
      ).toBe('Lịch học: IELTS Writing');

      expect(
        formatClassSessionReminderNotification('en', {
          id: 'session-study',
          date: '2026-10-27',
          startTime: '19:00',
          subject: 'IELTS Writing',
          category: 'self_study',
        }).title,
      ).toBe('Study session: IELTS Writing');
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

    it('includes tag "${type}-${targetId}-${remindAtMs}" and data.remindAt ISO string when remindAt is provided across task, class_session, and note', () => {
      const remindAt = new Date('2026-10-27T02:45:00.000Z');
      const remindAtMs = remindAt.getTime();
      const remindAtIso = remindAt.toISOString();

      const taskPayload = formatTaskReminderNotification(
        'vi',
        {
          id: 'task-abc',
          title: 'Soạn giáo án',
          time: '10:00',
          date: '2026-10-27',
        },
        remindAt,
      );
      expect(taskPayload.tag).toBe(`task-task-abc-${remindAtMs}`);
      expect(taskPayload.data.remindAt).toBe(remindAtIso);

      const sessionPayload = formatClassSessionReminderNotification(
        'vi',
        {
          id: 'slot-1:2026-10-27',
          date: '2026-10-27',
          startTime: '10:00',
          subject: 'Toán',
        },
        remindAt,
      );
      expect(sessionPayload.tag).toBe(`class_session-slot-1:2026-10-27-${remindAtMs}`);
      expect(sessionPayload.data.remindAt).toBe(remindAtIso);

      const notePayload = formatNoteReminderNotification(
        'vi',
        {
          id: 'note-123',
          title: 'Ghi chú',
          dueDate: '2026-10-27',
          remindTime: '10:00',
        },
        remindAt,
      );
      expect(notePayload.tag).toBe(`note-note-123-${remindAtMs}`);
      expect(notePayload.data.remindAt).toBe(remindAtIso);
    });
  });
});
