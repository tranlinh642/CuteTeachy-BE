import { DeleteClassSessionUseCase } from '../../../../src/application/class-session/delete-class-session.use-case';
import { InMemoryClassSessionRepository } from '../../../fakes/in-memory-class-session.repository';
import { FixedClock } from '../../../fakes/fixed-clock';
import { ClassSession } from '../../../../src/domain/class-session/class-session.entity';
import { CannotDeleteGeneratedSessionError } from '../../../../src/domain/class-session/class-session.errors';
import { EntityNotFoundError } from '../../../../src/domain/shared/sync.errors';

describe('DeleteClassSessionUseCase', () => {
  let sessionRepo: InMemoryClassSessionRepository;
  let clock: FixedClock;
  let useCase: DeleteClassSessionUseCase;

  const now = new Date('2026-10-27T08:00:00.000Z');
  const accountId = 'acc-teacher-1';
  const otherAccountId = 'acc-teacher-2';

  beforeEach(() => {
    sessionRepo = new InMemoryClassSessionRepository();
    clock = new FixedClock(now);
    useCase = new DeleteClassSessionUseCase(sessionRepo, clock);
  });

  it('throws CannotDeleteGeneratedSessionError (400) when id is a generated session (has colon)', async () => {
    const generatedId = '11111111-1111-4111-8111-111111111111:2026-10-26';

    await expect(
      useCase.execute({
        id: generatedId,
        accountId,
      }),
    ).rejects.toThrow(CannotDeleteGeneratedSessionError);
  });

  it('throws CannotDeleteGeneratedSessionError even if override exists in DB', async () => {
    const slotId = '11111111-1111-4111-8111-111111111111';
    const generatedId = `${slotId}:2026-10-26`;
    const override = ClassSession.createOverride({
      accountId,
      timetableSlotId: slotId,
      date: '2026-10-26',
      now,
    });
    await sessionRepo.save(override);

    await expect(
      useCase.execute({
        id: generatedId,
        accountId,
      }),
    ).rejects.toThrow(CannotDeleteGeneratedSessionError);
  });

  it('soft deletes ad-hoc session', async () => {
    const adHocId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const adHoc = ClassSession.createAdHoc({
      id: adHocId,
      accountId,
      date: '2026-10-28',
      startTime: '08:00',
      endTime: '09:30',
      subject: 'Toán',
      tone: 'blue',
      now,
    });
    await sessionRepo.save(adHoc);

    await useCase.execute({
      id: adHocId,
      accountId,
    });

    const deleted = await sessionRepo.findById(adHocId);
    expect(deleted).not.toBeNull();
    expect(deleted!.isDeleted()).toBe(true);
    expect(deleted!.deletedAt).toEqual(now);
  });

  it('is idempotent when deleting already deleted ad-hoc session', async () => {
    const adHocId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const adHoc = ClassSession.createAdHoc({
      id: adHocId,
      accountId,
      date: '2026-10-28',
      startTime: '08:00',
      endTime: '09:30',
      subject: 'Toán',
      tone: 'blue',
      now,
    });
    adHoc.delete(now);
    await sessionRepo.save(adHoc);

    // Should not throw
    await useCase.execute({
      id: adHocId,
      accountId,
    });
  });

  it('throws EntityNotFoundError when ad-hoc session does not exist or belongs to another teacher', async () => {
    await expect(
      useCase.execute({
        id: 'non-existent-uuid',
        accountId,
      }),
    ).rejects.toThrow(EntityNotFoundError);

    const adHocId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const adHoc = ClassSession.createAdHoc({
      id: adHocId,
      accountId: otherAccountId,
      date: '2026-10-28',
      startTime: '08:00',
      endTime: '09:30',
      subject: 'Toán',
      tone: 'blue',
      now,
    });
    await sessionRepo.save(adHoc);

    await expect(
      useCase.execute({
        id: adHocId,
        accountId,
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });
});
