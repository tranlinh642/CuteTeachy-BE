import { UpdateTimetableSlotUseCase } from '../../../../src/application/timetable/update-timetable-slot.use-case';
import { InMemoryTimetableSlotRepository } from '../../../fakes/in-memory-timetable-slot.repository';
import { InMemoryClassSessionRepository } from '../../../fakes/in-memory-class-session.repository';
import { FakeUnitOfWork } from '../../../fakes/fake-unit-of-work';
import { TimetableSlot } from '../../../../src/domain/timetable/timetable-slot.entity';
import { ClassSession } from '../../../../src/domain/class-session/class-session.entity';
import { TimetableConflictError } from '../../../../src/domain/timetable/timetable.errors';
import { EntityNotFoundError } from '../../../../src/domain/shared/sync.errors';
import type { TeacherSettingsReader } from '../../../../src/application/settings/ports/teacher-settings.port';
import type { Clock } from '../../../../src/application/shared/ports/clock.port';
import type { IdGenerator } from '../../../../src/application/shared/ports/id-generator.port';
import { Settings } from '../../../../src/domain/settings/settings.entity';

describe('UpdateTimetableSlotUseCase', () => {
  let slotRepo: InMemoryTimetableSlotRepository;
  let sessionRepo: InMemoryClassSessionRepository;
  let uow: FakeUnitOfWork;
  let settingsReader: TeacherSettingsReader;
  let clock: Clock;
  let idGenerator: IdGenerator;
  let useCase: UpdateTimetableSlotUseCase;

  const accountId = 'teacher-1';
  let currentTime: Date;
  let teacherTimeZone: string;
  let generatedIdCounter = 1;

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

    idGenerator = {
      next: () => `99999999-9999-4999-8999-${String(generatedIdCounter++).padStart(12, '0')}`,
      generate: () => `99999999-9999-4999-8999-${String(generatedIdCounter++).padStart(12, '0')}`,
    };

    useCase = new UpdateTimetableSlotUseCase(
      uow,
      settingsReader,
      idGenerator,
      clock,
    );
  });

  describe('Slot with past sessions (effectiveFrom < today) -> SPLIT', () => {
    const existingSlotId = '11111111-1111-4111-8111-111111111111';

    beforeEach(async () => {
      const slot = TimetableSlot.create({
        id: existingSlotId,
        accountId,
        weekday: 1, // Monday
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Toán học',
        grade: '10A',
        room: '101',
        tone: 'blue',
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-12-31',
        now: new Date('2026-10-01T00:00:00.000Z'),
      });
      await slotRepo.save(slot);
    });

    it('splits slot into previous (ending yesterday) and current (starting today), returning { previous, current }', async () => {
      const result = await useCase.execute({
        id: existingSlotId,
        accountId,
        subject: 'Toán học nâng cao',
        room: 'Lab 1',
      });

      expect(result.previous).toBeDefined();
      expect(result.previous?.id).toBe(existingSlotId);
      expect(result.previous?.effectiveFrom).toBe('2026-10-01');
      expect(result.previous?.effectiveTo).toBe('2026-10-26'); // yesterday
      expect(result.previous?.subject).toBe('Toán học'); // original subject

      expect(result.current).toBeDefined();
      expect(result.current.id).not.toBe(existingSlotId);
      expect(result.current.effectiveFrom).toBe('2026-10-27'); // today
      expect(result.current.effectiveTo).toBe('2026-12-31'); // preserved
      expect(result.current.subject).toBe('Toán học nâng cao');
      expect(result.current.room).toBe('Lab 1');
      expect(result.current.grade).toBe('10A');

      // Verify DB state
      const oldSlotInDb = await slotRepo.findById(existingSlotId);
      expect(oldSlotInDb?.effectiveTo).toBe('2026-10-26');
      const newSlotInDb = await slotRepo.findById(result.current.id);
      expect(newSlotInDb).toBeDefined();
      expect(newSlotInDb?.effectiveFrom).toBe('2026-10-27');
    });

    it('transfers overrides from today onwards when weekday and times do not change', async () => {
      // Create past override and future override
      const pastOverride = ClassSession.createOverride({
        accountId,
        timetableSlotId: existingSlotId,
        date: '2026-10-19', // past Monday
        topic: 'Past topic',
        now: currentTime,
      });
      const futureOverride = ClassSession.createOverride({
        accountId,
        timetableSlotId: existingSlotId,
        date: '2026-11-02', // future Monday
        topic: 'Future topic',
        now: currentTime,
      });
      await sessionRepo.save(pastOverride);
      await sessionRepo.save(futureOverride);

      const result = await useCase.execute({
        id: existingSlotId,
        accountId,
        subject: 'Toán đổi tên',
      });

      // Past override still belongs to old slot
      const pastAfter = await sessionRepo.findById(`${existingSlotId}:2026-10-19`);
      expect(pastAfter).toBeDefined();
      expect(pastAfter?.timetableSlotId).toBe(existingSlotId);

      // Future override transferred to new slot
      const oldFuture = await sessionRepo.findById(`${existingSlotId}:2026-11-02`);
      expect(oldFuture).toBeNull();

      const newFuture = await sessionRepo.findById(`${result.current.id}:2026-11-02`);
      expect(newFuture).toBeDefined();
      expect(newFuture?.timetableSlotId).toBe(result.current.id);
      expect(newFuture?.topic).toBe('Future topic');
    });

    it('discards overrides from today onwards when weekday or time changes', async () => {
      const pastOverride = ClassSession.createOverride({
        accountId,
        timetableSlotId: existingSlotId,
        date: '2026-10-19',
        topic: 'Past topic',
        now: currentTime,
      });
      const futureOverride = ClassSession.createOverride({
        accountId,
        timetableSlotId: existingSlotId,
        date: '2026-11-02',
        topic: 'Future topic',
        now: currentTime,
      });
      await sessionRepo.save(pastOverride);
      await sessionRepo.save(futureOverride);

      const result = await useCase.execute({
        id: existingSlotId,
        accountId,
        weekday: 3, // Changed Monday -> Wednesday
      });

      // Past override still preserved
      const pastAfter = await sessionRepo.findById(`${existingSlotId}:2026-10-19`);
      expect(pastAfter).toBeDefined();

      // Future override discarded (session no longer on Monday)
      const oldFuture = await sessionRepo.findById(`${existingSlotId}:2026-11-02`);
      expect(oldFuture).toBeNull();
      const newFuture = await sessionRepo.findById(`${result.current.id}:2026-11-02`);
      expect(newFuture).toBeNull();
    });

    it('throws 409 timetable_conflict and rolls back completely when split slot conflicts with an existing slot', async () => {
      // Existing conflicting slot on Wednesday 08:00 - 09:00
      const conflictingSlot = TimetableSlot.create({
        id: '22222222-2222-4222-8222-222222222222',
        accountId,
        weekday: 3,
        startTime: '08:00',
        endTime: '09:00',
        subject: 'Hóa học',
        tone: 'rose',
        effectiveFrom: '2026-10-20',
        now: currentTime,
      });
      await slotRepo.save(conflictingSlot);

      // Attempt to split oldSlot into Wednesday 08:15 - 09:00 (overlaps with conflictingSlot)
      await expect(
        useCase.execute({
          id: existingSlotId,
          accountId,
          weekday: 3,
          startTime: '08:15',
          endTime: '09:00',
        }),
      ).rejects.toThrow(TimetableConflictError);

      // Check rollback: oldSlot effectiveTo must NOT have been changed
      const oldSlotInDb = await slotRepo.findById(existingSlotId);
      expect(oldSlotInDb?.effectiveTo).toBe('2026-12-31');
    });
  });

  describe('Slot with no past sessions (effectiveFrom >= today) -> EDIT IN PLACE', () => {
    const futureSlotId = '33333333-3333-4333-8333-333333333333';

    beforeEach(async () => {
      const slot = TimetableSlot.create({
        id: futureSlotId,
        accountId,
        weekday: 2, // Tuesday
        startTime: '08:00',
        endTime: '08:45',
        subject: 'Vật lý',
        tone: 'lavender',
        effectiveFrom: '2026-10-27', // today
        effectiveTo: '2026-12-31',
        now: currentTime,
      });
      await slotRepo.save(slot);
    });

    it('updates slot in place, returning only { current } without previous', async () => {
      const result = await useCase.execute({
        id: futureSlotId,
        accountId,
        subject: 'Vật lý 10',
        room: '205',
      });

      expect(result.previous).toBeUndefined();
      expect(result.current.id).toBe(futureSlotId);
      expect(result.current.subject).toBe('Vật lý 10');
      expect(result.current.room).toBe('205');
      expect(result.current.effectiveFrom).toBe('2026-10-27');
    });

    it('throws 409 conflict when in-place edit causes collision with another slot', async () => {
      const otherSlot = TimetableSlot.create({
        id: '44444444-4444-4444-8444-444444444444',
        accountId,
        weekday: 4,
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Lịch sử',
        tone: 'beige',
        effectiveFrom: '2026-10-01',
        now: currentTime,
      });
      await slotRepo.save(otherSlot);

      await expect(
        useCase.execute({
          id: futureSlotId,
          accountId,
          weekday: 4,
          startTime: '10:30',
          endTime: '11:30',
        }),
      ).rejects.toThrow(TimetableConflictError);
    });
  });

  describe('Teacher timezone and clock boundaries around midnight', () => {
    it('determines "today" correctly for Asia/Ho_Chi_Minh (UTC+7) at 17:30 UTC (00:30 next day local)', async () => {
      // 2026-10-26T17:30:00Z -> In Vietnam (UTC+7), this is 2026-10-27T00:30:00 (Oct 27)
      currentTime = new Date('2026-10-26T17:30:00.000Z');
      teacherTimeZone = 'Asia/Ho_Chi_Minh';

      // Slot with effectiveFrom = 2026-10-26 has past sessions in Vietnam (2026-10-26 < 2026-10-27)
      const slotId = '55555555-5555-4555-8555-555555555555';
      const slot = TimetableSlot.create({
        id: slotId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Địa lý',
        tone: 'mint',
        effectiveFrom: '2026-10-26',
        now: new Date('2026-10-26T00:00:00.000Z'),
      });
      await slotRepo.save(slot);

      const result = await useCase.execute({
        id: slotId,
        accountId,
        subject: 'Địa lý mới',
      });

      // Must be split because in Vietnam today is 2026-10-27!
      expect(result.previous).toBeDefined();
      expect(result.previous?.effectiveTo).toBe('2026-10-26');
      expect(result.current.effectiveFrom).toBe('2026-10-27');
    });

    it('determines "today" correctly for America/New_York (UTC-4) at same UTC time (13:30 local same day)', async () => {
      // 2026-10-26T17:30:00Z -> In New York (EDT, UTC-4), this is 2026-10-26T13:30:00 (Oct 26)
      currentTime = new Date('2026-10-26T17:30:00.000Z');
      teacherTimeZone = 'America/New_York';

      // Slot with effectiveFrom = 2026-10-26 is effective today in New York (2026-10-26 >= 2026-10-26)
      const slotId = '66666666-6666-4666-8666-666666666666';
      const slot = TimetableSlot.create({
        id: slotId,
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Địa lý',
        tone: 'mint',
        effectiveFrom: '2026-10-26',
        now: new Date('2026-10-26T00:00:00.000Z'),
      });
      await slotRepo.save(slot);

      const result = await useCase.execute({
        id: slotId,
        accountId,
        subject: 'Địa lý New York',
      });

      // In New York, effectiveFrom is today, so edited IN PLACE (no previous)!
      expect(result.previous).toBeUndefined();
      expect(result.current.id).toBe(slotId);
      expect(result.current.subject).toBe('Địa lý New York');
      expect(result.current.effectiveFrom).toBe('2026-10-26');
    });
  });

  describe('Not found & access control', () => {
    it('throws EntityNotFoundError when slot does not exist', async () => {
      await expect(
        useCase.execute({
          id: '00000000-0000-4000-8000-000000000000',
          accountId,
          subject: 'Toán',
        }),
      ).rejects.toThrow(EntityNotFoundError);
    });

    it('throws EntityNotFoundError when slot belongs to another teacher', async () => {
      const slot = TimetableSlot.create({
        id: '77777777-7777-4777-8777-777777777777',
        accountId: 'other-teacher',
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Văn',
        tone: 'rose',
        effectiveFrom: '2026-10-01',
        now: currentTime,
      });
      await slotRepo.save(slot);

      await expect(
        useCase.execute({
          id: slot.id,
          accountId,
          subject: 'Văn mới',
        }),
      ).rejects.toThrow(EntityNotFoundError);
    });

    it('throws EntityNotFoundError when slot is soft deleted', async () => {
      const slot = TimetableSlot.create({
        id: '88888888-8888-4888-8888-888888888888',
        accountId,
        weekday: 1,
        startTime: '07:30',
        endTime: '08:15',
        subject: 'Văn',
        tone: 'rose',
        effectiveFrom: '2026-10-27',
        now: currentTime,
      });
      slot.delete(currentTime);
      await slotRepo.save(slot);

      await expect(
        useCase.execute({
          id: slot.id,
          accountId,
          subject: 'Văn mới',
        }),
      ).rejects.toThrow(EntityNotFoundError);
    });
  });
});
