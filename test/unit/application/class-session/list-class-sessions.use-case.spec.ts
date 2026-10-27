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
});
