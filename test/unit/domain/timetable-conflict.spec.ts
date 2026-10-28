import { TimetableSlot } from '../../../src/domain/timetable/timetable-slot.entity';
import {
  hasTimetableConflict,
  findConflictingSlot,
} from '../../../src/domain/timetable/timetable-conflict';

describe('Timetable Conflict Domain Logic', () => {
  const now = new Date('2026-10-27T08:00:00.000Z');
  const baseSlot = TimetableSlot.create({
    id: '11111111-1111-4111-8111-111111111111',
    accountId: 'acc-1',
    weekday: 1, // Monday
    startTime: '07:30',
    endTime: '09:00',
    subject: 'Sinh học',
    tone: 'blue',
    effectiveFrom: '2026-10-01',
    effectiveTo: '2026-10-31',
    now,
  });

  it('detects conflict when weekday, time, and effective period overlap', () => {
    const candidate = {
      weekday: 1,
      startTime: '08:00',
      endTime: '08:45',
      effectiveFrom: '2026-10-15',
      effectiveTo: '2026-11-15',
    };

    expect(hasTimetableConflict(candidate, [baseSlot])).toBe(true);
    expect(findConflictingSlot(candidate, [baseSlot])?.id).toBe(baseSlot.id);
  });

  it('does NOT conflict when touching time edges (07:00-07:30 vs 07:30-09:00)', () => {
    const candidateBefore = {
      weekday: 1,
      startTime: '07:00',
      endTime: '07:30',
      effectiveFrom: '2026-10-01',
      effectiveTo: '2026-10-31',
    };

    const candidateAfter = {
      weekday: 1,
      startTime: '09:00',
      endTime: '09:45',
      effectiveFrom: '2026-10-01',
      effectiveTo: '2026-10-31',
    };

    expect(hasTimetableConflict(candidateBefore, [baseSlot])).toBe(false);
    expect(hasTimetableConflict(candidateAfter, [baseSlot])).toBe(false);
  });

  it('does NOT conflict when weekdays are different', () => {
    const candidate = {
      weekday: 2, // Tuesday
      startTime: '07:30',
      endTime: '09:00',
      effectiveFrom: '2026-10-01',
      effectiveTo: '2026-10-31',
    };

    expect(hasTimetableConflict(candidate, [baseSlot])).toBe(false);
  });

  it('does NOT conflict when effective periods do not overlap', () => {
    const candidatePast = {
      weekday: 1,
      startTime: '07:30',
      endTime: '09:00',
      effectiveFrom: '2026-09-01',
      effectiveTo: '2026-09-30',
    };

    const candidateFuture = {
      weekday: 1,
      startTime: '07:30',
      endTime: '09:00',
      effectiveFrom: '2026-11-01',
      effectiveTo: '2026-11-30',
    };

    expect(hasTimetableConflict(candidatePast, [baseSlot])).toBe(false);
    expect(hasTimetableConflict(candidateFuture, [baseSlot])).toBe(false);
  });

  it('detects conflict when effective period boundary touches on a single day', () => {
    // baseSlot is 2026-10-01 to 2026-10-31. Candidate starts 2026-10-31.
    const candidate = {
      weekday: 1,
      startTime: '07:30',
      endTime: '09:00',
      effectiveFrom: '2026-10-31',
      effectiveTo: '2026-11-30',
    };

    expect(hasTimetableConflict(candidate, [baseSlot])).toBe(true);
  });

  it('detects conflict with open-ended slot (effectiveTo = null)', () => {
    const openEndedSlot = TimetableSlot.create({
      id: '22222222-2222-4222-8222-222222222222',
      accountId: 'acc-1',
      weekday: 3,
      startTime: '14:00',
      endTime: '15:30',
      subject: 'Hóa học',
      tone: 'rose',
      effectiveFrom: '2026-10-01',
      now,
    });

    const candidate = {
      weekday: 3,
      startTime: '15:00',
      endTime: '16:00',
      effectiveFrom: '2027-05-01',
    };

    expect(hasTimetableConflict(candidate, [openEndedSlot])).toBe(true);
  });

  it('ignores candidate slot if existing slot has same id', () => {
    const candidate = {
      id: baseSlot.id,
      weekday: 1,
      startTime: '07:30',
      endTime: '09:00',
      effectiveFrom: '2026-10-01',
      effectiveTo: '2026-10-31',
    };

    expect(hasTimetableConflict(candidate, [baseSlot])).toBe(false);
  });

  it('ignores soft-deleted existing slots', () => {
    const deletedSlot = TimetableSlot.rehydrate({
      id: '33333333-3333-4333-8333-333333333333',
      accountId: 'acc-1',
      weekday: 1,
      startTime: '07:30',
      endTime: '09:00',
      subject: 'Toán học',
      tone: 'mint',
      effectiveFrom: '2026-10-01',
      effectiveTo: '2026-10-31',
      createdAt: now,
      updatedAt: now,
      deletedAt: now,
    });

    const candidate = {
      weekday: 1,
      startTime: '07:30',
      endTime: '09:00',
      effectiveFrom: '2026-10-01',
      effectiveTo: '2026-10-31',
    };

    expect(hasTimetableConflict(candidate, [deletedSlot])).toBe(false);
  });
});
