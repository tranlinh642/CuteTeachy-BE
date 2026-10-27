import { DeleteTimetableSlotUseCase } from '../../../../src/application/timetable/delete-timetable-slot.use-case';
import { InMemoryTimetableSlotRepository } from '../../../fakes/in-memory-timetable-slot.repository';
import { InMemoryClassSessionRepository } from '../../../fakes/in-memory-class-session.repository';
import { FakeUnitOfWork } from '../../../fakes/fake-unit-of-work';
import { TimetableSlot } from '../../../../src/domain/timetable/timetable-slot.entity';
import { ClassSession } from '../../../../src/domain/class-session/class-session.entity';
import { EntityNotFoundError } from '../../../../src/domain/shared/sync.errors';
import type { TeacherSettingsReader } from '../../../../src/application/settings/ports/teacher-settings.port';
import type { Clock } from '../../../../src/application/shared/ports/clock.port';
import { Settings } from '../../../../src/domain/settings/settings.entity';

describe('DeleteTimetableSlotUseCase', () => {
  let slotRepo: InMemoryTimetableSlotRepository;
  let sessionRepo: InMemoryClassSessionRepository;
  let uow: FakeUnitOfWork;
  let settingsReader: TeacherSettingsReader;
  let clock: Clock;
  let useCase: DeleteTimetableSlotUseCase;

  const accountId = 'teacher-1';
  let currentTime: Date;
  let teacherTimeZone: string;

  beforeEach(() => {
    slotRepo = new InMemoryTimetableSlotRepository();
    sessionRepo = new InMemoryClassSessionRepository();
    uow = new FakeUnitOfWork({
      timetableSlotRepo: slotRepo,
      classSessionRepo: sessionRepo,
    });

    currentTime = new Date('2026-10-27T08:00:00.000Z');
    teacherTimeZone = 'Asia/Ho_Chi_Minh';

    clock = {
      now: () => currentTime,
    };

    settingsReader = {
      getSettings: async (accId: string) => {
        if (accId !== accountId) return null;
        return Settings.createDefault(accountId, {
          timeZone: teacherTimeZone,
          now: currentTime,
        });
      },
    };

    useCase = new DeleteTimetableSlotUseCase(
      uow,
      settingsReader,
      clock,
    );
  });

  describe('Slot with past sessions (effectiveFrom < today) -> END AT YESTERDAY', () => {
    const slotId = '11111111-1111-4111-8111-111111111111';

    beforeEach(async () => {
      const slot = TimetableSlot.create({
        id: slotId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Toán học',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-12-31',
        now: new Date('2026-10-01T00:00:00.000Z'),
      });
      await slotRepo.save(slot);
    });

    it('ends slot at yesterday (effectiveTo = yesterday) without soft deleting', async () => {
      await useCase.execute({ id: slotId, accountId });

      const slotInDb = await slotRepo.findById(slotId);
      expect(slotInDb).toBeDefined();
      expect(slotInDb?.effectiveTo).toBe('2026-10-26'); // yesterday
      expect(slotInDb?.isDeleted()).toBe(false);
      expect(slotInDb?.deletedAt).toBeNull();
    });

    it('discards future overrides (date >= today) while keeping past overrides', async () => {
      const pastOverride = ClassSession.createOverride({
        accountId,
        timetableSlotId: slotId,
        date: '2026-10-19',
        topic: 'Past topic',
        now: currentTime,
      });
      const futureOverride = ClassSession.createOverride({
        accountId,
        timetableSlotId: slotId,
        date: '2026-11-02',
        topic: 'Future topic',
        now: currentTime,
      });
      await sessionRepo.save(pastOverride);
      await sessionRepo.save(futureOverride);

      await useCase.execute({ id: slotId, accountId });

      expect(await sessionRepo.findById(`${slotId}:2026-10-19`)).toBeDefined();
      expect(await sessionRepo.findById(`${slotId}:2026-11-02`)).toBeNull();
    });
  });

  describe('Slot with no past sessions (effectiveFrom >= today) -> SOFT DELETE', () => {
    const slotId = '22222222-2222-4222-8222-222222222222';

    beforeEach(async () => {
      const slot = TimetableSlot.create({
        id: slotId,
        accountId,
        weekday: 3,
        startTime: '08:00',
        endTime: '08:45',
        subject: 'Vật lý',
        tone: 'rose',
        effectiveFrom: '2026-10-27', // today
        now: currentTime,
      });
      await slotRepo.save(slot);
    });

    it('soft deletes slot (deletedAt is set)', async () => {
      await useCase.execute({ id: slotId, accountId });

      const slotInDb = await slotRepo.findById(slotId);
      expect(slotInDb).toBeDefined();
      expect(slotInDb?.isDeleted()).toBe(true);
      expect(slotInDb?.deletedAt).toEqual(currentTime);
    });
  });

  describe('Idempotence & access control', () => {
    it('is a no-op when slot is already soft-deleted', async () => {
      const slotId = '33333333-3333-4333-8333-333333333333';
      const slot = TimetableSlot.create({
        id: slotId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Toán',
        tone: 'mint',
        effectiveFrom: '2026-10-27',
        now: currentTime,
      });
      slot.delete(currentTime);
      await slotRepo.save(slot);

      await expect(useCase.execute({ id: slotId, accountId })).resolves.not.toThrow();
    });

    it('throws EntityNotFoundError when slot belongs to another teacher', async () => {
      const slotId = '44444444-4444-4444-8444-444444444444';
      const slot = TimetableSlot.create({
        id: slotId,
        accountId: 'other-teacher',
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Toán',
        tone: 'mint',
        effectiveFrom: '2026-10-27',
        now: currentTime,
      });
      await slotRepo.save(slot);

      await expect(useCase.execute({ id: slotId, accountId })).rejects.toThrow(
        EntityNotFoundError,
      );
    });

    it('throws EntityNotFoundError when slot does not exist', async () => {
      await expect(
        useCase.execute({
          id: '00000000-0000-4000-8000-000000000000',
          accountId,
        }),
      ).rejects.toThrow(EntityNotFoundError);
    });
  });
});
