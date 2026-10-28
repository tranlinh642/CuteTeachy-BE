import { ListTimetableSlotsUseCase } from '../../../../src/application/timetable/list-timetable-slots.use-case';
import { InMemoryTimetableSlotRepository } from '../../../fakes/in-memory-timetable-slot.repository';
import { FixedClock } from '../../../fakes/fixed-clock';
import { TimetableSlot } from '../../../../src/domain/timetable/timetable-slot.entity';
import { SyncValidationError } from '../../../../src/domain/shared/sync.errors';

describe('ListTimetableSlotsUseCase', () => {
  let repo: InMemoryTimetableSlotRepository;
  let clock: FixedClock;
  let useCase: ListTimetableSlotsUseCase;

  const now = new Date('2026-10-27T08:00:00.000Z');
  const accountId = 'acc-teacher-1';

  beforeEach(() => {
    repo = new InMemoryTimetableSlotRepository();
    clock = new FixedClock(now);
    useCase = new ListTimetableSlotsUseCase(repo, clock);
  });

  it('lists active slots without updatedSince', async () => {
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
    await repo.save(slot);

    const envelope = await useCase.execute({ accountId });

    expect(envelope.items).toHaveLength(1);
    expect(envelope.items[0].id).toBe(slot.id);
    expect(envelope.deletedIds).toEqual([]);
    expect(envelope.serverTime).toBe(now.toISOString());
  });

  it('filters by updatedSince', async () => {
    const pastTime = new Date('2026-10-20T08:00:00.000Z');
    const oldSlot = TimetableSlot.create({
      id: '11111111-1111-4111-8111-111111111111',
      accountId,
      weekday: 1,
      startTime: '07:30',
      endTime: '08:15',
      subject: 'Sinh học',
      tone: 'blue',
      effectiveFrom: '2026-10-01',
      now: pastTime,
    });
    await repo.save(oldSlot);

    const newSlot = TimetableSlot.create({
      id: '22222222-2222-4222-8222-222222222222',
      accountId,
      weekday: 2,
      startTime: '08:30',
      endTime: '09:15',
      subject: 'Hóa học',
      tone: 'pink',
      effectiveFrom: '2026-10-01',
      now,
    });
    await repo.save(newSlot);

    const envelope = await useCase.execute({
      accountId,
      updatedSince: '2026-10-25T00:00:00.000Z',
    });

    expect(envelope.items).toHaveLength(1);
    expect(envelope.items[0].id).toBe(newSlot.id);
  });

  it('rejects updatedSince older than 30 days', async () => {
    await expect(
      useCase.execute({
        accountId,
        updatedSince: '2026-09-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(SyncValidationError);
  });
});
