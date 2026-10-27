import { TimetableSlot } from '../../../src/domain/timetable/timetable-slot.entity';
import { generateClassSessions } from '../../../src/domain/class-session/class-session-generator';

describe('ClassSession Generator Domain Logic', () => {
  const now = new Date('2026-10-20T08:00:00.000Z');

  // Slot 1: Monday (weekday 1) 07:30–08:15, effective 2026-10-26 to 2026-11-09
  // 2026-10-26 is Monday
  // 2026-11-02 is Monday
  // 2026-11-09 is Monday
  const slot1 = TimetableSlot.create({
    id: '11111111-1111-4111-8111-111111111111',
    accountId: 'acc-1',
    weekday: 1,
    startTime: '07:30',
    endTime: '08:15',
    subject: 'Sinh học',
    grade: '10A',
    room: '302',
    tone: 'blue',
    effectiveFrom: '2026-10-26',
    effectiveTo: '2026-11-09',
    now,
  });

  // Slot 2: Wednesday (weekday 3) 09:00–10:30, effective 2026-10-01, open-ended
  // 2026-10-28 is Wednesday
  // 2026-11-04 is Wednesday
  const slot2 = TimetableSlot.create({
    id: '22222222-2222-4222-8222-222222222222',
    accountId: 'acc-1',
    weekday: 3,
    startTime: '09:00',
    endTime: '10:30',
    subject: 'Hóa học',
    tone: 'rose',
    effectiveFrom: '2026-10-01',
    now,
  });

  it('generates sessions crossing week and month boundaries with stable IDs', () => {
    // Range from 2026-10-25 (Sun) to 2026-11-05 (Thu)
    const sessions = generateClassSessions([slot1, slot2], '2026-10-25', '2026-11-05');

    // Expected sessions:
    // 2026-10-26 (Mon): slot1
    // 2026-10-28 (Wed): slot2
    // 2026-11-02 (Mon): slot1
    // 2026-11-04 (Wed): slot2
    expect(sessions).toHaveLength(4);

    expect(sessions[0]).toEqual({
      id: `${slot1.id}:2026-10-26`,
      timetableSlotId: slot1.id,
      date: '2026-10-26',
      startTime: '07:30',
      endTime: '08:15',
      subject: 'Sinh học',
      grade: '10A',
      room: '302',
      tone: 'blue',
      prepItems: [],
      cancelled: false,
      updatedAt: now.toISOString(),
    });

    expect(sessions[1]).toEqual({
      id: `${slot2.id}:2026-10-28`,
      timetableSlotId: slot2.id,
      date: '2026-10-28',
      startTime: '09:00',
      endTime: '10:30',
      subject: 'Hóa học',
      tone: 'rose',
      prepItems: [],
      cancelled: false,
      updatedAt: now.toISOString(),
    });

    expect(sessions[2].id).toBe(`${slot1.id}:2026-11-02`);
    expect(sessions[3].id).toBe(`${slot2.id}:2026-11-04`);
  });

  it('produces identical deterministic sessions on repeated runs', () => {
    const run1 = generateClassSessions([slot1, slot2], '2026-10-25', '2026-11-05');
    const run2 = generateClassSessions([slot1, slot2], '2026-10-25', '2026-11-05');

    expect(run1).toEqual(run2);
  });

  it('respects effectiveFrom and effectiveTo boundaries', () => {
    // Before slot1 starts (2026-10-26), e.g. 2026-10-19 (Monday)
    const beforeStart = generateClassSessions([slot1], '2026-10-19', '2026-10-19');
    expect(beforeStart).toHaveLength(0);

    // Exact effectiveFrom date: 2026-10-26 (Monday)
    const onStart = generateClassSessions([slot1], '2026-10-26', '2026-10-26');
    expect(onStart).toHaveLength(1);
    expect(onStart[0].date).toBe('2026-10-26');

    // Exact effectiveTo date: 2026-11-09 (Monday)
    const onEnd = generateClassSessions([slot1], '2026-11-09', '2026-11-09');
    expect(onEnd).toHaveLength(1);
    expect(onEnd[0].date).toBe('2026-11-09');

    // After effectiveTo: 2026-11-16 (Monday)
    const afterEnd = generateClassSessions([slot1], '2026-11-16', '2026-11-16');
    expect(afterEnd).toHaveLength(0);
  });

  it('sorts multiple sessions on same date by startTime', () => {
    const slot3 = TimetableSlot.create({
      id: '33333333-3333-4333-8333-333333333333',
      accountId: 'acc-1',
      weekday: 1, // Same Monday
      startTime: '13:00',
      endTime: '14:30',
      subject: 'Toán học',
      tone: 'mint',
      effectiveFrom: '2026-10-01',
      now,
    });

    const sessions = generateClassSessions([slot3, slot1], '2026-10-26', '2026-10-26');
    expect(sessions).toHaveLength(2);
    // slot1 is 07:30, slot3 is 13:00
    expect(sessions[0].startTime).toBe('07:30');
    expect(sessions[1].startTime).toBe('13:00');
  });

  it('ignores deleted slots', () => {
    const deletedSlot = TimetableSlot.rehydrate({
      id: '44444444-4444-4444-8444-444444444444',
      accountId: 'acc-1',
      weekday: 1,
      startTime: '10:00',
      endTime: '11:00',
      subject: 'Văn học',
      tone: 'pink',
      effectiveFrom: '2026-10-01',
      createdAt: now,
      updatedAt: now,
      deletedAt: now,
    });

    const sessions = generateClassSessions([deletedSlot], '2026-10-26', '2026-10-26');
    expect(sessions).toHaveLength(0);
  });
});
