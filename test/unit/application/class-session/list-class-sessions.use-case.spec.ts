import { ListClassSessionsUseCase } from '../../../../src/application/class-session/list-class-sessions.use-case';
import { InMemoryTimetableSlotRepository } from '../../../fakes/in-memory-timetable-slot.repository';
import { InMemoryClassSessionRepository } from '../../../fakes/in-memory-class-session.repository';
import { FixedClock } from '../../../fakes/fixed-clock';
import { TimetableSlot } from '../../../../src/domain/timetable/timetable-slot.entity';
import { ClassSession } from '../../../../src/domain/class-session/class-session.entity';
import { ClassSessionValidationError } from '../../../../src/domain/class-session/class-session.errors';
import { SyncValidationError } from '../../../../src/domain/shared/sync.errors';

describe('ListClassSessionsUseCase', () => {
  let slotRepo: InMemoryTimetableSlotRepository;
  let sessionRepo: InMemoryClassSessionRepository;
  let clock: FixedClock;
  let useCase: ListClassSessionsUseCase;

  const now = new Date('2026-10-27T08:00:00.000Z');
  const accountId = 'acc-teacher-1';

  beforeEach(() => {
    slotRepo = new InMemoryTimetableSlotRepository();
    sessionRepo = new InMemoryClassSessionRepository();
    clock = new FixedClock(now);
    useCase = new ListClassSessionsUseCase(slotRepo, sessionRepo, clock);
  });

  it('generates sessions for active slots within given date range (<= 42 days)', async () => {
    // 2026-10-26 is Monday (weekday 1)
    const slot = TimetableSlot.create({
      id: '11111111-1111-4111-8111-111111111111',
      accountId,
      weekday: 1,
      startTime: '07:30',
      endTime: '08:15',
      subject: 'Sinh học',
      grade: '10A',
      room: '302',
      tone: 'blue',
      effectiveFrom: '2026-10-01',
      effectiveTo: '2026-10-31',
      now,
    });
    await slotRepo.save(slot);

    const envelope = await useCase.execute({
      accountId,
      from: '2026-10-26',
      to: '2026-10-30',
    });

    expect(envelope.items).toHaveLength(1);
    expect(envelope.items[0]).toEqual({
      id: `${slot.id}:2026-10-26`,
      timetableSlotId: slot.id,
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
    expect(envelope.deletedIds).toEqual([]);
    expect(envelope.serverTime).toBe(now.toISOString());
  });

  it('applies override to generated session (topic, prepItems, cancelled)', async () => {
    const slotId = '11111111-1111-4111-8111-111111111111';
    const slot = TimetableSlot.create({
      id: slotId,
      accountId,
      weekday: 1,
      startTime: '07:30',
      endTime: '08:15',
      subject: 'Sinh học',
      tone: 'blue',
      effectiveFrom: '2026-10-01',
      now,
    });
    await slotRepo.save(slot);

    const overrideTime = new Date('2026-10-27T08:30:00.000Z');
    const override = ClassSession.createOverride({
      accountId,
      timetableSlotId: slotId,
      date: '2026-10-26',
      topic: 'Chủ đề 1: Tế bào',
      prepItems: [{ id: 'p1', label: 'Chuẩn bị kính hiển vi', done: true }],
      cancelled: true,
      now: overrideTime,
    });
    await sessionRepo.save(override);

    const envelope = await useCase.execute({
      accountId,
      from: '2026-10-26',
      to: '2026-10-30',
    });

    expect(envelope.items).toHaveLength(1);
    const item = envelope.items[0];
    expect(item.id).toBe(`${slotId}:2026-10-26`);
    expect(item.topic).toBe('Chủ đề 1: Tế bào');
    expect(item.prepItems).toEqual([{ id: 'p1', label: 'Chuẩn bị kính hiển vi', done: true }]);
    expect(item.cancelled).toBe(true); // cancelled session is still returned with cancelled=true
    expect(item.updatedAt).toBe(overrideTime.toISOString());
  });

  it('includes active ad-hoc sessions and excludes soft-deleted ones', async () => {
    const activeAdHoc = ClassSession.createAdHoc({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      accountId,
      date: '2026-10-27',
      startTime: '09:00',
      endTime: '10:00',
      subject: 'Dạy bù Vật lý',
      tone: 'lavender',
      now,
    });
    await sessionRepo.save(activeAdHoc);

    const deletedAdHoc = ClassSession.createAdHoc({
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
      accountId,
      date: '2026-10-28',
      startTime: '10:00',
      endTime: '11:00',
      subject: 'Dạy thay',
      tone: 'mint',
      now,
    });
    deletedAdHoc.delete(now);
    await sessionRepo.save(deletedAdHoc);

    const envelope = await useCase.execute({
      accountId,
      from: '2026-10-26',
      to: '2026-10-30',
    });

    expect(envelope.items).toHaveLength(1);
    expect(envelope.items[0].id).toBe(activeAdHoc.id);
    expect(envelope.items[0].timetableSlotId).toBeNull();
    expect(envelope.items[0].subject).toBe('Dạy bù Vật lý');
  });

  it('sorts generated sessions and ad-hoc sessions by date, startTime, and id', async () => {
    // Slot Monday 07:30
    const slot = TimetableSlot.create({
      id: '11111111-1111-4111-8111-111111111111',
      accountId,
      weekday: 1,
      startTime: '07:30',
      endTime: '08:15',
      subject: 'Sinh học',
      tone: 'blue',
      effectiveFrom: '2026-10-01',
      now,
    });
    await slotRepo.save(slot);

    // Ad-hoc on Monday 07:00 (earlier time)
    const adHocMondayEarly = ClassSession.createAdHoc({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      accountId,
      date: '2026-10-26',
      startTime: '07:00',
      endTime: '07:30',
      subject: 'Sinh hoạt đầu tuần',
      tone: 'rose',
      now,
    });
    await sessionRepo.save(adHocMondayEarly);

    // Ad-hoc on Sunday 2026-10-25 (earlier date)
    const adHocSunday = ClassSession.createAdHoc({
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
      accountId,
      date: '2026-10-25',
      startTime: '08:00',
      endTime: '09:00',
      subject: 'Dạy bù',
      tone: 'mint',
      now,
    });
    await sessionRepo.save(adHocSunday);

    const envelope = await useCase.execute({
      accountId,
      from: '2026-10-25',
      to: '2026-10-30',
    });

    expect(envelope.items).toHaveLength(3);
    expect(envelope.items[0].id).toBe(adHocSunday.id);
    expect(envelope.items[1].id).toBe(adHocMondayEarly.id);
    expect(envelope.items[2].id).toBe(`${slot.id}:2026-10-26`);
  });

  it('rejects range exceeding 42 days', async () => {
    await expect(
      useCase.execute({
        accountId,
        from: '2026-10-01',
        to: '2026-11-13',
      }),
    ).rejects.toThrow(ClassSessionValidationError);
  });

  it('rejects from date after to date', async () => {
    await expect(
      useCase.execute({
        accountId,
        from: '2026-10-15',
        to: '2026-10-01',
      }),
    ).rejects.toThrow(ClassSessionValidationError);
  });

  it('rejects updatedSince older than 30 days', async () => {
    await expect(
      useCase.execute({
        accountId,
        from: '2026-10-01',
        to: '2026-10-15',
        updatedSince: '2026-09-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(SyncValidationError);
  });

  it('rejects invalid updatedSince date string', async () => {
    await expect(
      useCase.execute({
        accountId,
        from: '2026-10-01',
        to: '2026-10-15',
        updatedSince: 'not-a-valid-date',
      }),
    ).rejects.toThrow(SyncValidationError);
  });

  describe('Delta Sync (updatedSince)', () => {
    const t0 = new Date('2026-10-20T00:00:00.000Z');
    const syncTime = '2026-10-25T00:00:00.000Z';
    const t1 = new Date('2026-10-27T08:00:00.000Z');

    it('returns only changed overrides and ad-hoc sessions when NO slot has changed', async () => {
      // Slot 1: Monday, created at t0, not modified
      const slot = TimetableSlot.create({
        id: '11111111-1111-4111-8111-111111111111',
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-10-31',
        now: t0,
      });
      await slotRepo.save(slot);

      // Unchanged ad-hoc on Wednesday 2026-10-28 (updatedAt t0 <= syncTime)
      const unchangedAdHoc = ClassSession.createAdHoc({
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        accountId,
        date: '2026-10-28',
        startTime: '09:00',
        endTime: '10:00',
        subject: 'Sinh hoạt cũ',
        tone: 'pink',
        now: t0,
      });
      await sessionRepo.save(unchangedAdHoc);

      // Override on Monday 2026-10-26, created at t1 (> syncTime)
      const override = ClassSession.createOverride({
        accountId,
        timetableSlotId: slot.id,
        date: '2026-10-26',
        topic: 'Chủ đề mới sau sync',
        cancelled: false,
        now: t1,
      });
      await sessionRepo.save(override);

      // Changed ad-hoc on Thursday 2026-10-29, created at t1 (> syncTime)
      const changedAdHoc = ClassSession.createAdHoc({
        id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
        accountId,
        date: '2026-10-29',
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Dạy bù mới',
        tone: 'mint',
        now: t1,
      });
      await sessionRepo.save(changedAdHoc);

      // Soft-deleted ad-hoc on Friday 2026-10-30, deleted at t1 (> syncTime)
      const deletedAdHoc = ClassSession.createAdHoc({
        id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33',
        accountId,
        date: '2026-10-30',
        startTime: '14:00',
        endTime: '15:00',
        subject: 'Buổi đã xoá',
        tone: 'lavender',
        now: t0,
      });
      deletedAdHoc.delete(t1);
      await sessionRepo.save(deletedAdHoc);

      // Soft-deleted ad-hoc on Saturday 2026-10-31, deleted at t0 (<= syncTime)
      const oldDeletedAdHoc = ClassSession.createAdHoc({
        id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d44',
        accountId,
        date: '2026-10-31',
        startTime: '16:00',
        endTime: '17:00',
        subject: 'Buổi xoá từ lâu',
        tone: 'rose',
        now: t0,
      });
      oldDeletedAdHoc.delete(t0);
      await sessionRepo.save(oldDeletedAdHoc);

      const envelope = await useCase.execute({
        accountId,
        from: '2026-10-26',
        to: '2026-10-31',
        updatedSince: syncTime,
      });

      // Only changed override and changed ad-hoc in items
      expect(envelope.items).toHaveLength(2);
      expect(envelope.items[0].id).toBe(`${slot.id}:2026-10-26`);
      expect(envelope.items[0].topic).toBe('Chủ đề mới sau sync');
      expect(envelope.items[1].id).toBe(changedAdHoc.id);

      // Only ad-hoc deleted after syncTime in deletedIds
      expect(envelope.deletedIds).toEqual([deletedAdHoc.id]);
      expect(envelope.serverTime).toBe(now.toISOString());
    });

    it('returns ALL sessions in range when a slot was created after updatedSince', async () => {
      // Slot created at t1 (> syncTime)
      const slot = TimetableSlot.create({
        id: '11111111-1111-4111-8111-111111111111',
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-10-31',
        now: t1,
      });
      await slotRepo.save(slot);

      const envelope = await useCase.execute({
        accountId,
        from: '2026-10-26',
        to: '2026-10-31',
        updatedSince: syncTime,
      });

      expect(envelope.items).toHaveLength(1);
      expect(envelope.items[0].id).toBe(`${slot.id}:2026-10-26`);
      expect(envelope.deletedIds).toEqual([]);
    });

    it('returns ALL sessions and deletedIds for defunct sessions when a slot was ended/split', async () => {
      // Old slot on Monday (weekday 1) effective 2026-10-01 to 2026-11-30, created at t0
      const oldSlot = TimetableSlot.create({
        id: '11111111-1111-4111-8111-111111111111',
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-11-30',
        now: t0,
      });
      // Ended at yesterday (2026-10-27) at t1 (> syncTime)
      oldSlot.endAt('2026-10-27', t1);
      await slotRepo.save(oldSlot);

      // New slot on Friday (weekday 5) effective from 2026-10-28 to 2026-11-30, created at t1
      const newSlot = TimetableSlot.create({
        id: '22222222-2222-4222-8222-222222222222',
        accountId,
        weekday: 5,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-28',
        effectiveTo: '2026-11-30',
        now: t1,
      });
      await slotRepo.save(newSlot);

      // Date range across 2 weeks: 2026-10-26 (Monday) to 2026-11-08 (Sunday)
      const envelope = await useCase.execute({
        accountId,
        from: '2026-10-26',
        to: '2026-11-08',
        updatedSince: syncTime,
      });

      // Active items in range:
      // - oldSlot on Monday 2026-10-26 (before effectiveTo 2026-10-27)
      // - newSlot on Friday 2026-10-30
      // - newSlot on Friday 2026-11-06
      expect(envelope.items).toHaveLength(3);
      expect(envelope.items.map((i) => i.id)).toEqual([
        `${oldSlot.id}:2026-10-26`,
        `${newSlot.id}:2026-10-30`,
        `${newSlot.id}:2026-11-06`,
      ]);

      // Defunct session: oldSlot on Monday 2026-11-02 (was effective previously, now date > effectiveTo)
      expect(envelope.deletedIds).toEqual([`${oldSlot.id}:2026-11-02`]);
    });

    it('returns deletedIds for all sessions of a slot that was soft-deleted', async () => {
      // Slot on Monday effective 2026-10-01 to 2026-11-30, created at t0
      const slot = TimetableSlot.create({
        id: '11111111-1111-4111-8111-111111111111',
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-11-30',
        now: t0,
      });
      slot.delete(t1); // soft-deleted at t1 (> syncTime)
      await slotRepo.save(slot);

      // Ad-hoc session also soft-deleted at t1
      const adHoc = ClassSession.createAdHoc({
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        accountId,
        date: '2026-10-28',
        startTime: '09:00',
        endTime: '10:00',
        subject: 'Dạy bù',
        tone: 'mint',
        now: t0,
      });
      adHoc.delete(t1);
      await sessionRepo.save(adHoc);

      const envelope = await useCase.execute({
        accountId,
        from: '2026-10-26',
        to: '2026-11-08',
        updatedSince: syncTime,
      });

      // No active sessions
      expect(envelope.items).toHaveLength(0);

      // Deleted IDs include:
      // - slot session on 2026-10-26
      // - slot session on 2026-11-02
      // - deleted ad-hoc session
      expect(envelope.deletedIds).toEqual(
        [`${slot.id}:2026-10-26`, `${slot.id}:2026-11-02`, adHoc.id].sort(),
      );
    });
  });
});
