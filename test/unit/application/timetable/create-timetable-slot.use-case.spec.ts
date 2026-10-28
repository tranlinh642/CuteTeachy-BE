import { CreateTimetableSlotUseCase } from '../../../../src/application/timetable/create-timetable-slot.use-case';
import { InMemoryTimetableSlotRepository } from '../../../fakes/in-memory-timetable-slot.repository';
import { FixedClock } from '../../../fakes/fixed-clock';
import {
  PayloadConflictError,
  TimetableConflictError,
} from '../../../../src/domain/timetable/timetable.errors';
import { IdConflictError, EntityGoneError } from '../../../../src/domain/shared/sync.errors';
import { TimetableSlot } from '../../../../src/domain/timetable/timetable-slot.entity';

describe('CreateTimetableSlotUseCase', () => {
  let repo: InMemoryTimetableSlotRepository;
  let clock: FixedClock;
  let useCase: CreateTimetableSlotUseCase;

  const now = new Date('2026-10-27T08:00:00.000Z');
  const accountId = 'acc-teacher-1';
  const slotId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    repo = new InMemoryTimetableSlotRepository();
    clock = new FixedClock(now);
    useCase = new CreateTimetableSlotUseCase(repo, clock);
  });

  it('creates a new timetable slot successfully', async () => {
    const output = await useCase.execute({
      id: slotId,
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
    });

    expect(output.created).toBe(true);
    expect(output.slot.id).toBe(slotId);
    expect(output.slot.subject).toBe('Sinh học');
    expect(output.slot.startTime).toBe('07:30');
    expect(output.slot.endTime).toBe('08:15');

    const saved = await repo.findById(slotId);
    expect(saved).not.toBeNull();
  });

  it('returns existing slot with created: false when payload is identical', async () => {
    const input = {
      id: slotId,
      accountId,
      weekday: 1,
      startTime: '07:30',
      endTime: '08:15',
      subject: 'Sinh học',
      grade: '10A',
      room: '302',
      tone: 'blue' as const,
      effectiveFrom: '2026-10-01',
      effectiveTo: '2026-12-31',
    };

    const first = await useCase.execute(input);
    expect(first.created).toBe(true);

    const second = await useCase.execute(input);
    expect(second.created).toBe(false);
    expect(second.slot).toEqual(first.slot);
  });

  it('throws PayloadConflictError when id exists with different payload', async () => {
    await useCase.execute({
      id: slotId,
      accountId,
      weekday: 1,
      startTime: '07:30',
      endTime: '08:15',
      subject: 'Sinh học',
      tone: 'blue',
      effectiveFrom: '2026-10-01',
    });

    await expect(
      useCase.execute({
        id: slotId,
        accountId,
        weekday: 1,
        startTime: '08:00', // Different start time!
        endTime: '08:45',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
      }),
    ).rejects.toThrow(PayloadConflictError);
  });

  it('throws IdConflictError when id belongs to another account', async () => {
    await useCase.execute({
      id: slotId,
      accountId: 'other-acc',
      weekday: 1,
      startTime: '07:30',
      endTime: '08:15',
      subject: 'Sinh học',
      tone: 'blue',
      effectiveFrom: '2026-10-01',
    });

    await expect(
      useCase.execute({
        id: slotId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
      }),
    ).rejects.toThrow(IdConflictError);
  });

  it('throws EntityGoneError when existing slot was soft deleted', async () => {
    const deletedSlot = TimetableSlot.rehydrate({
      id: slotId,
      accountId,
      weekday: 1,
      startTime: '07:30',
      endTime: '08:15',
      subject: 'Sinh học',
      tone: 'blue',
      effectiveFrom: '2026-10-01',
      createdAt: now,
      updatedAt: now,
      deletedAt: now,
    });
    await repo.save(deletedSlot);

    await expect(
      useCase.execute({
        id: slotId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Sinh học',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
      }),
    ).rejects.toThrow(EntityGoneError);
  });

  it('throws TimetableConflictError when overlapping with existing active slot', async () => {
    await useCase.execute({
      id: slotId,
      accountId,
      weekday: 1,
      startTime: '07:30',
      endTime: '09:00',
      subject: 'Sinh học',
      tone: 'blue',
      effectiveFrom: '2026-10-01',
      effectiveTo: '2026-10-31',
    });

    const newSlotId = '22222222-2222-4222-8222-222222222222';
    await expect(
      useCase.execute({
        id: newSlotId,
        accountId,
        weekday: 1,
        startTime: '08:00',
        endTime: '08:45',
        subject: 'Hóa học',
        tone: 'pink',
        effectiveFrom: '2026-10-15',
        effectiveTo: '2026-11-15',
      }),
    ).rejects.toThrow(TimetableConflictError);
  });

  it('creates successfully when time slots touch edges (07:00-07:30 vs 07:30-09:00)', async () => {
    await useCase.execute({
      id: slotId,
      accountId,
      weekday: 1,
      startTime: '07:30',
      endTime: '09:00',
      subject: 'Sinh học',
      tone: 'blue',
      effectiveFrom: '2026-10-01',
      effectiveTo: '2026-10-31',
    });

    const newSlotId = '22222222-2222-4222-8222-222222222222';
    const output = await useCase.execute({
      id: newSlotId,
      accountId,
      weekday: 1,
      startTime: '07:00',
      endTime: '07:30',
      subject: 'Hóa học',
      tone: 'pink',
      effectiveFrom: '2026-10-01',
      effectiveTo: '2026-10-31',
    });

    expect(output.created).toBe(true);
  });
});
