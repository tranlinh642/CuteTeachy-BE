import { TimetableSlot } from '../../../src/domain/timetable/timetable-slot.entity';
import { TimetableValidationError } from '../../../src/domain/timetable/timetable.errors';

describe('TimetableSlot Entity', () => {
  const validId = '11111111-1111-4111-8111-111111111111';
  const accountId = 'acc-1';
  const now = new Date('2026-10-27T08:00:00.000Z');

  describe('create', () => {
    it('creates a valid slot with all fields', () => {
      const slot = TimetableSlot.create({
        id: validId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        grade: '10A',
        room: '302',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-12-31',
        now,
      });

      expect(slot.id).toBe(validId);
      expect(slot.accountId).toBe(accountId);
      expect(slot.weekday).toBe(1);
      expect(slot.startTime).toBe('07:30');
      expect(slot.endTime).toBe('08:15');
      expect(slot.subject).toBe('Sinh học');
      expect(slot.grade).toBe('10A');
      expect(slot.room).toBe('302');
      expect(slot.tone).toBe('blue');
      expect(slot.effectiveFrom).toBe('2026-10-01');
      expect(slot.effectiveTo).toBe('2026-12-31');
      expect(slot.createdAt).toEqual(now);
      expect(slot.updatedAt).toEqual(now);
      expect(slot.deletedAt).toBeNull();
      expect(slot.isDeleted()).toBe(false);
    });

    it('creates a valid slot without optional grade, room, and effectiveTo', () => {
      const slot = TimetableSlot.create({
        id: validId,
        accountId,
        weekday: 5,
        startTime: '08:30',
        endTime: '09:15',
        subject: 'Toán học',
        tone: 'pink',
        effectiveFrom: '2026-10-01',
        now,
      });

      expect(slot.grade).toBeNull();
      expect(slot.room).toBeNull();
      expect(slot.effectiveTo).toBeNull();
    });

    it('trims subject, grade, room and converts empty strings to null', () => {
      const slot = TimetableSlot.create({
        id: validId,
        accountId,
        weekday: 2,
        startTime: '10:00',
        endTime: '11:00',
        subject: '   Văn học   ',
        grade: '   ',
        room: '   102   ',
        tone: 'mint',
        effectiveFrom: '2026-10-01',
        now,
      });

      expect(slot.subject).toBe('Văn học');
      expect(slot.grade).toBeNull();
      expect(slot.room).toBe('102');
    });

    it('rejects invalid UUID', () => {
      expect(() =>
        TimetableSlot.create({
          id: 'invalid-uuid',
          accountId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          now,
        }),
      ).toThrow(TimetableValidationError);
    });

    it('rejects weekday outside 1..7 or non-integer', () => {
      expect(() =>
        TimetableSlot.create({
          id: validId,
          accountId,
          weekday: 0,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          now,
        }),
      ).toThrow(TimetableValidationError);

      expect(() =>
        TimetableSlot.create({
          id: validId,
          accountId,
          weekday: 8,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          now,
        }),
      ).toThrow(TimetableValidationError);

      expect(() =>
        TimetableSlot.create({
          id: validId,
          accountId,
          weekday: 2.5,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          now,
        }),
      ).toThrow(TimetableValidationError);
    });

    it('rejects invalid time formats or startTime >= endTime', () => {
      expect(() =>
        TimetableSlot.create({
          id: validId,
          accountId,
          weekday: 1,
          startTime: '7:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          now,
        }),
      ).toThrow(TimetableValidationError);

      expect(() =>
        TimetableSlot.create({
          id: validId,
          accountId,
          weekday: 1,
          startTime: '08:15',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          now,
        }),
      ).toThrow(TimetableValidationError);

      expect(() =>
        TimetableSlot.create({
          id: validId,
          accountId,
          weekday: 1,
          startTime: '09:00',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          now,
        }),
      ).toThrow(TimetableValidationError);
    });

    it('rejects subject longer than 120 characters or empty', () => {
      expect(() =>
        TimetableSlot.create({
          id: validId,
          accountId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: '   ',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          now,
        }),
      ).toThrow(TimetableValidationError);

      expect(() =>
        TimetableSlot.create({
          id: validId,
          accountId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'a'.repeat(121),
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          now,
        }),
      ).toThrow(TimetableValidationError);
    });

    it('rejects invalid tone', () => {
      expect(() =>
        TimetableSlot.create({
          id: validId,
          accountId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'red' as any,
          effectiveFrom: '2026-10-01',
          now,
        }),
      ).toThrow(TimetableValidationError);
    });

    it('rejects invalid calendar dates or effectiveTo < effectiveFrom', () => {
      expect(() =>
        TimetableSlot.create({
          id: validId,
          accountId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-02-30',
          now,
        }),
      ).toThrow(TimetableValidationError);

      expect(() =>
        TimetableSlot.create({
          id: validId,
          accountId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-15',
          effectiveTo: '2026-10-10',
          now,
        }),
      ).toThrow(TimetableValidationError);
    });
  });

  describe('matchesPayload', () => {
    it('returns true when all properties match', () => {
      const slot = TimetableSlot.create({
        id: validId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        grade: '10A',
        room: '302',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-12-31',
        now,
      });

      expect(
        slot.matchesPayload({
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: '  Sinh học  ',
          grade: '10A',
          room: '302',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          effectiveTo: '2026-12-31',
        }),
      ).toBe(true);
    });

    it('returns false when any property differs', () => {
      const slot = TimetableSlot.create({
        id: validId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        grade: '10A',
        room: '302',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-12-31',
        now,
      });

      expect(
        slot.matchesPayload({
          weekday: 2,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          grade: '10A',
          room: '302',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          effectiveTo: '2026-12-31',
        }),
      ).toBe(false);

      expect(
        slot.matchesPayload({
          weekday: 1,
          startTime: '08:00',
          endTime: '08:15',
          subject: 'Sinh học',
          grade: '10A',
          room: '302',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          effectiveTo: '2026-12-31',
        }),
      ).toBe(false);

      expect(
        slot.matchesPayload({
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Hóa học',
          grade: '10A',
          room: '302',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          effectiveTo: '2026-12-31',
        }),
      ).toBe(false);
    });
  });

  describe('hasPastSessions', () => {
    it('returns true when effectiveFrom is before today', () => {
      const slot = TimetableSlot.create({
        id: validId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
        now,
      });

      expect(slot.hasPastSessions('2026-10-27')).toBe(true);
    });

    it('returns false when effectiveFrom is equal to today or in the future', () => {
      const slot = TimetableSlot.create({
        id: validId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-27',
        now,
      });

      expect(slot.hasPastSessions('2026-10-27')).toBe(false);
      expect(slot.hasPastSessions('2026-10-20')).toBe(false);
    });
  });

  describe('endAt', () => {
    it('sets effectiveTo to yesterday and updates updatedAt', () => {
      const slot = TimetableSlot.create({
        id: validId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-12-31',
        now,
      });

      const updatedTime = new Date('2026-10-27T10:00:00.000Z');
      slot.endAt('2026-10-26', updatedTime);

      expect(slot.effectiveTo).toBe('2026-10-26');
      expect(slot.updatedAt).toEqual(updatedTime);
      expect(slot.isDeleted()).toBe(false);
    });
  });

  describe('delete', () => {
    it('sets deletedAt and updates updatedAt', () => {
      const slot = TimetableSlot.create({
        id: validId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-27',
        now,
      });

      const deletedTime = new Date('2026-10-27T10:00:00.000Z');
      slot.delete(deletedTime);

      expect(slot.isDeleted()).toBe(true);
      expect(slot.deletedAt).toEqual(deletedTime);
      expect(slot.updatedAt).toEqual(deletedTime);
    });
  });

  describe('update', () => {
    it('updates fields in place and validates', () => {
      const slot = TimetableSlot.create({
        id: validId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-27',
        now,
      });

      const updatedTime = new Date('2026-10-27T11:00:00.000Z');
      slot.update({
        weekday: 3,
        startTime: '08:30',
        endTime: '09:15',
        subject: 'Hóa học 11',
        grade: '11B',
        room: 'Lab 2',
        tone: 'mint',
        effectiveFrom: '2026-10-28',
        effectiveTo: '2026-12-20',
        now: updatedTime,
      });

      expect(slot.weekday).toBe(3);
      expect(slot.startTime).toBe('08:30');
      expect(slot.endTime).toBe('09:15');
      expect(slot.subject).toBe('Hóa học 11');
      expect(slot.grade).toBe('11B');
      expect(slot.room).toBe('Lab 2');
      expect(slot.tone).toBe('mint');
      expect(slot.effectiveFrom).toBe('2026-10-28');
      expect(slot.effectiveTo).toBe('2026-12-20');
      expect(slot.updatedAt).toEqual(updatedTime);
    });

    it('throws validation error when updated times are invalid', () => {
      const slot = TimetableSlot.create({
        id: validId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-27',
        now,
      });

      expect(() => {
        slot.update({
          startTime: '09:00',
          endTime: '08:00',
          now,
        });
      }).toThrow(TimetableValidationError);
    });
  });
});
