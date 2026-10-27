import { ListClassSessionsUseCase } from '../../../../src/application/class-session/list-class-sessions.use-case';
import { InMemoryTimetableSlotRepository } from '../../../fakes/in-memory-timetable-slot.repository';
import { FixedClock } from '../../../fakes/fixed-clock';
import { TimetableSlot } from '../../../../src/domain/timetable/timetable-slot.entity';
import { ClassSessionValidationError } from '../../../../src/domain/class-session/class-session.errors';
import { SyncValidationError } from '../../../../src/domain/shared/sync.errors';

describe('ListClassSessionsUseCase', () => {
  let repo: InMemoryTimetableSlotRepository;
  let clock: FixedClock;
  let useCase: ListClassSessionsUseCase;

  const now = new Date('2026-10-27T08:00:00.000Z');
  const accountId = 'acc-teacher-1';

  beforeEach(() => {
    repo = new InMemoryTimetableSlotRepository();
    clock = new FixedClock(now);
    useCase = new ListClassSessionsUseCase(repo, clock);
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
    await repo.save(slot);

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
