import { CreateAdHocClassSessionUseCase } from '../../../../src/application/class-session/create-adhoc-class-session.use-case';
import { InMemoryClassSessionRepository } from '../../../fakes/in-memory-class-session.repository';
import { FixedClock } from '../../../fakes/fixed-clock';
import { ClassSession } from '../../../../src/domain/class-session/class-session.entity';
import {
  IdConflictError,
  EntityGoneError,
} from '../../../../src/domain/shared/sync.errors';
import { PayloadConflictError } from '../../../../src/domain/class-session/class-session.errors';

describe('CreateAdHocClassSessionUseCase', () => {
  let sessionRepo: InMemoryClassSessionRepository;
  let clock: FixedClock;
  let useCase: CreateAdHocClassSessionUseCase;

  const now = new Date('2026-10-27T08:00:00.000Z');
  const accountId = 'acc-teacher-1';
  const otherAccountId = 'acc-teacher-2';

  const baseInput = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    accountId,
    date: '2026-10-28',
    startTime: '08:00',
    endTime: '09:30',
    subject: 'Toán học nâng cao',
    grade: '12A1',
    room: 'P.101',
    tone: 'blue' as const,
    topic: 'Luyện đề',
    prepItems: [{ id: 'item-1', label: 'In đề thi', done: false }],
    cancelled: false,
  };

  beforeEach(() => {
    sessionRepo = new InMemoryClassSessionRepository();
    clock = new FixedClock(now);
    useCase = new CreateAdHocClassSessionUseCase(sessionRepo, clock);
  });

  it('creates an ad-hoc session successfully with created: true', async () => {
    const result = await useCase.execute(baseInput);

    expect(result.created).toBe(true);
    expect(result.session.id).toBe(baseInput.id);
    expect(result.session.timetableSlotId).toBeNull();
    expect(result.session.subject).toBe(baseInput.subject);
    expect(result.session.prepItems).toHaveLength(1);
    expect(result.session.cancelled).toBe(false);

    const saved = await sessionRepo.findById(baseInput.id);
    expect(saved).not.toBeNull();
    expect(saved!.isAdHoc()).toBe(true);
  });

  it('returns existing session with created: false when payload matches identically (idempotent)', async () => {
    await useCase.execute(baseInput);

    const result = await useCase.execute(baseInput);

    expect(result.created).toBe(false);
    expect(result.session.id).toBe(baseInput.id);
  });

  it('throws PayloadConflictError (409 conflict) when payload differs from existing resource', async () => {
    await useCase.execute(baseInput);

    await expect(
      useCase.execute({
        ...baseInput,
        subject: 'Toán học cơ bản', // changed subject
      }),
    ).rejects.toThrow(PayloadConflictError);
  });

  it('throws IdConflictError (409 id_conflict) when id belongs to another account', async () => {
    const existing = ClassSession.createAdHoc({
      ...baseInput,
      accountId: otherAccountId,
      now,
    });
    await sessionRepo.save(existing);

    await expect(useCase.execute(baseInput)).rejects.toThrow(IdConflictError);
  });

  it('throws EntityGoneError (410 gone) when resource with id has been soft-deleted', async () => {
    const existing = ClassSession.createAdHoc({
      ...baseInput,
      now,
    });
    existing.delete(now);
    await sessionRepo.save(existing);

    await expect(useCase.execute(baseInput)).rejects.toThrow(EntityGoneError);
  });
});
