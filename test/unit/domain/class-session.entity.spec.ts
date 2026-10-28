import { ClassSession } from '../../../src/domain/class-session/class-session.entity';
import {
  CannotDeleteGeneratedSessionError,
  ClassSessionValidationError,
} from '../../../src/domain/class-session/class-session.errors';

describe('ClassSession Entity', () => {
  const now = new Date('2026-10-27T08:00:00.000Z');
  const later = new Date('2026-10-27T09:00:00.000Z');
  const accountId = 'acc-teacher-1';

  describe('Ad-hoc session (Buổi lẻ)', () => {
    const validAdHocProps = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      accountId,
      date: '2026-10-28',
      startTime: '08:00',
      endTime: '09:30',
      subject: 'Toán học nâng cao',
      grade: '12A1',
      room: 'P.101',
      tone: 'blue' as const,
      topic: 'Luyện đề thi thử',
      prepItems: [
        { id: 'item-1', label: 'In đề cương', done: false },
      ],
      cancelled: false,
      now,
    };

    it('creates a valid ad-hoc session', () => {
      const session = ClassSession.createAdHoc(validAdHocProps);

      expect(session.id).toBe(validAdHocProps.id);
      expect(session.accountId).toBe(accountId);
      expect(session.timetableSlotId).toBeNull();
      expect(session.date).toBe('2026-10-28');
      expect(session.startTime).toBe('08:00');
      expect(session.endTime).toBe('09:30');
      expect(session.subject).toBe('Toán học nâng cao');
      expect(session.grade).toBe('12A1');
      expect(session.room).toBe('P.101');
      expect(session.tone).toBe('blue');
      expect(session.topic).toBe('Luyện đề thi thử');
      expect(session.prepItems).toEqual([
        { id: 'item-1', label: 'In đề cương', done: false },
      ]);
      expect(session.cancelled).toBe(false);
      expect(session.isAdHoc()).toBe(true);
      expect(session.isOverride()).toBe(false);
      expect(session.isDeleted()).toBe(false);
      expect(session.createdAt).toEqual(now);
      expect(session.updatedAt).toEqual(now);
    });

    it('validates UUID for id', () => {
      expect(() =>
        ClassSession.createAdHoc({ ...validAdHocProps, id: 'not-a-uuid' }),
      ).toThrow(ClassSessionValidationError);
    });

    it('validates date format YYYY-MM-DD', () => {
      expect(() =>
        ClassSession.createAdHoc({ ...validAdHocProps, date: '28-10-2026' }),
      ).toThrow(ClassSessionValidationError);
    });

    it('validates startTime < endTime', () => {
      expect(() =>
        ClassSession.createAdHoc({
          ...validAdHocProps,
          startTime: '09:30',
          endTime: '08:00',
        }),
      ).toThrow(ClassSessionValidationError);
    });

    it('validates subject non-empty and max 120 chars', () => {
      expect(() =>
        ClassSession.createAdHoc({ ...validAdHocProps, subject: '   ' }),
      ).toThrow(ClassSessionValidationError);

      expect(() =>
        ClassSession.createAdHoc({ ...validAdHocProps, subject: 'a'.repeat(121) }),
      ).toThrow(ClassSessionValidationError);
    });

    it('checks matchesAdHocPayload correctly', () => {
      const session = ClassSession.createAdHoc(validAdHocProps);

      expect(
        session.matchesAdHocPayload({
          date: '2026-10-28',
          startTime: '08:00',
          endTime: '09:30',
          subject: 'Toán học nâng cao',
          grade: '12A1',
          room: 'P.101',
          tone: 'blue',
          topic: 'Luyện đề thi thử',
          prepItems: [{ id: 'item-1', label: 'In đề cương', done: false }],
          cancelled: false,
        }),
      ).toBe(true);

      // Different subject
      expect(
        session.matchesAdHocPayload({
          date: '2026-10-28',
          startTime: '08:00',
          endTime: '09:30',
          subject: 'Toán khác',
          tone: 'blue',
        }),
      ).toBe(false);
    });

    it('updates ad-hoc session fields', () => {
      const session = ClassSession.createAdHoc(validAdHocProps);

      session.updateAdHoc({
        subject: 'Toán học chuyên đề',
        room: 'P.202',
        cancelled: true,
        now: later,
      });

      expect(session.subject).toBe('Toán học chuyên đề');
      expect(session.room).toBe('P.202');
      expect(session.cancelled).toBe(true);
      expect(session.updatedAt).toEqual(later);
    });

    it('soft deletes ad-hoc session', () => {
      const session = ClassSession.createAdHoc(validAdHocProps);

      session.delete(later);

      expect(session.isDeleted()).toBe(true);
      expect(session.deletedAt).toEqual(later);
      expect(session.updatedAt).toEqual(later);
    });
  });

  describe('Override session (Ghi đè buổi sinh từ slot)', () => {
    const slotId = '11111111-1111-4111-8111-111111111111';
    const sessionDate = '2026-10-26';

    it('creates an override session with id = slotId:date', () => {
      const session = ClassSession.createOverride({
        accountId,
        timetableSlotId: slotId,
        date: sessionDate,
        topic: 'Bài 1: Mở đầu',
        prepItems: [{ id: 'prep-1', label: 'Mang tài liệu', done: true }],
        cancelled: false,
        now,
      });

      expect(session.id).toBe(`${slotId}:${sessionDate}`);
      expect(session.accountId).toBe(accountId);
      expect(session.timetableSlotId).toBe(slotId);
      expect(session.date).toBe(sessionDate);
      expect(session.startTime).toBeNull();
      expect(session.endTime).toBeNull();
      expect(session.subject).toBeNull();
      expect(session.topic).toBe('Bài 1: Mở đầu');
      expect(session.prepItems).toEqual([
        { id: 'prep-1', label: 'Mang tài liệu', done: true },
      ]);
      expect(session.cancelled).toBe(false);
      expect(session.isAdHoc()).toBe(false);
      expect(session.isOverride()).toBe(true);
      expect(session.createdAt).toEqual(now);
      expect(session.updatedAt).toEqual(now);
    });

    it('updates override fields (topic, prepItems, cancelled)', () => {
      const session = ClassSession.createOverride({
        accountId,
        timetableSlotId: slotId,
        date: sessionDate,
        topic: 'Bài 1',
        prepItems: [],
        cancelled: false,
        now,
      });

      session.updateOverride({
        cancelled: true,
        topic: 'Buổi học bị huỷ do họp hội đồng',
        now: later,
      });

      expect(session.cancelled).toBe(true);
      expect(session.topic).toBe('Buổi học bị huỷ do họp hội đồng');
      expect(session.updatedAt).toEqual(later);
    });

    it('throws CannotDeleteGeneratedSessionError when delete is called on override', () => {
      const session = ClassSession.createOverride({
        accountId,
        timetableSlotId: slotId,
        date: sessionDate,
        now,
      });

      expect(() => session.delete(later)).toThrow(CannotDeleteGeneratedSessionError);
    });
  });
});
