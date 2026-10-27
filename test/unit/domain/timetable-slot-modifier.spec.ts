import { TimetableSlot } from '../../../src/domain/timetable/timetable-slot.entity';
import {
  planSlotModification,
  planSlotDeletion,
} from '../../../src/domain/timetable/timetable-slot-modifier';

describe('Timetable Slot Modifier (Domain)', () => {
  const accountId = 'acc-1';
  const oldSlotId = '11111111-1111-4111-8111-111111111111';
  const newSlotId = '22222222-2222-4222-8222-222222222222';
  const now = new Date('2026-10-27T08:00:00.000Z');
  const today = '2026-10-27';
  const yesterday = '2026-10-26';

  describe('planSlotModification', () => {
    describe('when slot has past sessions (effectiveFrom < today) -> SPLIT', () => {
      it('splits slot, sets previous.effectiveTo = yesterday, and creates new slot with effectiveFrom = today (transfer overrides when weekday and time unchanged)', () => {
        const slot = TimetableSlot.create({
          id: oldSlotId,
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
          now: new Date('2026-10-01T08:00:00.000Z'),
        });

        const result = planSlotModification({
          slot,
          today,
          yesterday,
          newSlotId,
          now,
          updates: {
            subject: 'Sinh học nâng cao',
            room: 'Lab 1',
            tone: 'mint',
          },
        });

        expect(result.type).toBe('split');
        if (result.type === 'split') {
          // Previous slot ends yesterday
          expect(result.previous.id).toBe(oldSlotId);
          expect(result.previous.effectiveTo).toBe(yesterday);
          expect(result.previous.effectiveFrom).toBe('2026-10-01');
          expect(result.previous.subject).toBe('Sinh học'); // old subject preserved
          expect(result.previous.updatedAt).toEqual(now);

          // Current slot begins today with updated fields
          expect(result.current.id).toBe(newSlotId);
          expect(result.current.accountId).toBe(accountId);
          expect(result.current.weekday).toBe(1);
          expect(result.current.startTime).toBe('07:30');
          expect(result.current.endTime).toBe('08:15');
          expect(result.current.subject).toBe('Sinh học nâng cao');
          expect(result.current.grade).toBe('10A');
          expect(result.current.room).toBe('Lab 1');
          expect(result.current.tone).toBe('mint');
          expect(result.current.effectiveFrom).toBe(today);
          expect(result.current.effectiveTo).toBe('2026-12-31'); // preserved from old slot
          expect(result.current.updatedAt).toEqual(now);

          // Overrides action is transfer because weekday and times are unchanged
          expect(result.overridesAction).toBe('transfer');
        }
      });

      it('discards overrides when weekday changes during split', () => {
        const slot = TimetableSlot.create({
          id: oldSlotId,
          accountId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          now: new Date('2026-10-01T08:00:00.000Z'),
        });

        const result = planSlotModification({
          slot,
          today,
          yesterday,
          newSlotId,
          now,
          updates: {
            weekday: 3,
          },
        });

        expect(result.type).toBe('split');
        if (result.type === 'split') {
          expect(result.current.weekday).toBe(3);
          expect(result.overridesAction).toBe('discard');
        }
      });

      it('discards overrides when startTime or endTime changes during split', () => {
        const slot = TimetableSlot.create({
          id: oldSlotId,
          accountId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          now: new Date('2026-10-01T08:00:00.000Z'),
        });

        const result = planSlotModification({
          slot,
          today,
          yesterday,
          newSlotId,
          now,
          updates: {
            startTime: '08:00',
            endTime: '08:45',
          },
        });

        expect(result.type).toBe('split');
        if (result.type === 'split') {
          expect(result.overridesAction).toBe('discard');
        }
      });

      it('allows updating effectiveTo when splitting', () => {
        const slot = TimetableSlot.create({
          id: oldSlotId,
          accountId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          effectiveTo: '2026-12-31',
          now: new Date('2026-10-01T08:00:00.000Z'),
        });

        const result = planSlotModification({
          slot,
          today,
          yesterday,
          newSlotId,
          now,
          updates: {
            effectiveTo: '2026-11-30',
          },
        });

        expect(result.type).toBe('split');
        if (result.type === 'split') {
          expect(result.previous.effectiveTo).toBe(yesterday);
          expect(result.current.effectiveTo).toBe('2026-11-30');
        }
      });
    });

    describe('when slot has no past sessions (effectiveFrom >= today) -> EDIT IN PLACE', () => {
      it('updates slot in place without splitting (effectiveFrom = today)', () => {
        const slot = TimetableSlot.create({
          id: oldSlotId,
          accountId,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          tone: 'blue',
          effectiveFrom: '2026-10-27', // today
          now,
        });

        const result = planSlotModification({
          slot,
          today,
          yesterday,
          newSlotId,
          now,
          updates: {
            subject: 'Sinh học 10',
            room: '101',
          },
        });

        expect(result.type).toBe('in_place');
        if (result.type === 'in_place') {
          expect(result.current.id).toBe(oldSlotId);
          expect(result.current.subject).toBe('Sinh học 10');
          expect(result.current.room).toBe('101');
          expect(result.current.effectiveFrom).toBe('2026-10-27');
          expect(result.overridesAction).toBe('keep');
        }
      });

      it('updates slot in place when effectiveFrom is in future', () => {
        const slot = TimetableSlot.create({
          id: oldSlotId,
          accountId,
          weekday: 2,
          startTime: '09:00',
          endTime: '09:45',
          subject: 'Vật lý',
          tone: 'rose',
          effectiveFrom: '2026-11-01', // future
          now,
        });

        const result = planSlotModification({
          slot,
          today,
          yesterday,
          newSlotId,
          now,
          updates: {
            startTime: '10:00',
            endTime: '10:45',
          },
        });

        expect(result.type).toBe('in_place');
        if (result.type === 'in_place') {
          expect(result.current.id).toBe(oldSlotId);
          expect(result.current.startTime).toBe('10:00');
          expect(result.current.endTime).toBe('10:45');
          expect(result.overridesAction).toBe('discard');
        }
      });
    });
  });

  describe('planSlotDeletion', () => {
    it('ends slot at yesterday when effectiveFrom < today (has past sessions)', () => {
      const slot = TimetableSlot.create({
        id: oldSlotId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-12-31',
        now: new Date('2026-10-01T08:00:00.000Z'),
      });

      const result = planSlotDeletion(slot, today, yesterday, now);

      expect(result.type).toBe('ended');
      expect(result.slot.id).toBe(oldSlotId);
      expect(result.slot.effectiveTo).toBe(yesterday);
      expect(result.slot.isDeleted()).toBe(false);
      expect(result.slot.updatedAt).toEqual(now);
    });

    it('preserves existing effectiveTo if it was already in the past (< yesterday)', () => {
      const slot = TimetableSlot.create({
        id: oldSlotId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-10-15', // already ended before yesterday
        now: new Date('2026-10-01T08:00:00.000Z'),
      });

      const result = planSlotDeletion(slot, today, yesterday, now);

      expect(result.type).toBe('ended');
      expect(result.slot.effectiveTo).toBe('2026-10-15');
      expect(result.slot.isDeleted()).toBe(false);
    });

    it('soft deletes slot when effectiveFrom >= today (no past sessions)', () => {
      const slot = TimetableSlot.create({
        id: oldSlotId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-27', // today
        now,
      });

      const result = planSlotDeletion(slot, today, yesterday, now);

      expect(result.type).toBe('deleted');
      expect(result.slot.id).toBe(oldSlotId);
      expect(result.slot.isDeleted()).toBe(true);
      expect(result.slot.deletedAt).toEqual(now);
    });

    it('is a no-op when slot is already deleted', () => {
      const slot = TimetableSlot.create({
        id: oldSlotId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-27',
        now,
      });
      slot.delete(now);

      const result = planSlotDeletion(slot, today, yesterday, now);

      expect(result.type).toBe('noop');
      expect(result.slot.isDeleted()).toBe(true);
    });
  });
});
