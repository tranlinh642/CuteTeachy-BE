import { UpdateClassSessionUseCase } from '../../../../src/application/class-session/update-class-session.use-case';
import { InMemoryClassSessionRepository } from '../../../fakes/in-memory-class-session.repository';
import { InMemoryTimetableSlotRepository } from '../../../fakes/in-memory-timetable-slot.repository';
import { FixedClock } from '../../../fakes/fixed-clock';
import { TimetableSlot } from '../../../../src/domain/timetable/timetable-slot.entity';
import { ClassSession } from '../../../../src/domain/class-session/class-session.entity';
import { ClassSessionValidationError } from '../../../../src/domain/class-session/class-session.errors';
import { EntityNotFoundError } from '../../../../src/domain/shared/sync.errors';

describe('UpdateClassSessionUseCase', () => {
  let sessionRepo: InMemoryClassSessionRepository;
  let slotRepo: InMemoryTimetableSlotRepository;
  let clock: FixedClock;
  let useCase: UpdateClassSessionUseCase;

  const now = new Date('2026-10-27T08:00:00.000Z');
  const later = new Date('2026-10-27T09:00:00.000Z');
  const accountId = 'acc-teacher-1';
  const otherAccountId = 'acc-teacher-2';

  const slotId = '11111111-1111-4111-8111-111111111111';
  const mondayDate = '2026-10-26'; // Monday, weekday 1

  beforeEach(async () => {
    sessionRepo = new InMemoryClassSessionRepository();
    slotRepo = new InMemoryTimetableSlotRepository();
    clock = new FixedClock(now);
    useCase = new UpdateClassSessionUseCase(sessionRepo, slotRepo, clock);

    // Seed a timetable slot for Monday (weekday 1)
    const slot = TimetableSlot.create({
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
      effectiveTo: '2026-10-31',
      now,
    });
    await slotRepo.save(slot);
  });

  describe('Generated session (:id = slotId:date)', () => {
    const generatedSessionId = `${slotId}:${mondayDate}`;

    it('creates an override when updating generated session for the first time', async () => {
      clock.set(later);
      const res = await useCase.execute({
        id: generatedSessionId,
        accountId,
        topic: 'Bài 1: Mở đầu Sinh học',
        prepItems: [{ id: 'p1', label: 'Soạn slide', done: true }],
        cancelled: false,
      });

      expect(res.id).toBe(generatedSessionId);
      expect(res.timetableSlotId).toBe(slotId);
      expect(res.date).toBe(mondayDate);
      expect(res.startTime).toBe('07:30');
      expect(res.endTime).toBe('08:15');
      expect(res.subject).toBe('Sinh học');
      expect(res.topic).toBe('Bài 1: Mở đầu Sinh học');
      expect(res.prepItems).toEqual([{ id: 'p1', label: 'Soạn slide', done: true }]);
      expect(res.cancelled).toBe(false);
      expect(res.updatedAt).toBe(later.toISOString());

      const saved = await sessionRepo.findById(generatedSessionId);
      expect(saved).not.toBeNull();
      expect(saved!.isOverride()).toBe(true);
    });

    it('updates existing override on subsequent update', async () => {
      // First update
      await useCase.execute({
        id: generatedSessionId,
        accountId,
        topic: 'Bài 1',
        prepItems: [],
        cancelled: false,
      });

      // Second update: cancel the session
      clock.set(later);
      const res = await useCase.execute({
        id: generatedSessionId,
        accountId,
        cancelled: true,
      });

      expect(res.cancelled).toBe(true);
      expect(res.topic).toBe('Bài 1'); // preserved
      expect(res.updatedAt).toBe(later.toISOString());
    });

    it('allows restoring a cancelled session with cancelled: false', async () => {
      // First cancel
      await useCase.execute({
        id: generatedSessionId,
        accountId,
        cancelled: true,
      });

      // Then restore
      const res = await useCase.execute({
        id: generatedSessionId,
        accountId,
        cancelled: false,
      });

      expect(res.cancelled).toBe(false);
    });

    it('rejects attempt to modify structural fields (subject, date, times, etc.) on generated session', async () => {
      await expect(
        useCase.execute({
          id: generatedSessionId,
          accountId,
          subject: 'Toán học',
        }),
      ).rejects.toThrow(ClassSessionValidationError);

      await expect(
        useCase.execute({
          id: generatedSessionId,
          accountId,
          startTime: '08:00',
        }),
      ).rejects.toThrow(ClassSessionValidationError);
    });

    it('throws EntityNotFoundError when slot does not exist or belongs to another teacher', async () => {
      await expect(
        useCase.execute({
          id: `22222222-2222-4222-8222-222222222222:${mondayDate}`,
          accountId,
          cancelled: true,
        }),
      ).rejects.toThrow(EntityNotFoundError);

      await expect(
        useCase.execute({
          id: generatedSessionId,
          accountId: otherAccountId,
          cancelled: true,
        }),
      ).rejects.toThrow(EntityNotFoundError);
    });

    it('throws EntityNotFoundError when date does not match slot weekday or effective window', async () => {
      // 2026-10-27 is Tuesday (weekday 2), slot is for Monday (weekday 1)
      await expect(
        useCase.execute({
          id: `${slotId}:2026-10-27`,
          accountId,
          cancelled: true,
        }),
      ).rejects.toThrow(EntityNotFoundError);

      // Outside effective window (> 2026-10-31)
      await expect(
        useCase.execute({
          id: `${slotId}:2026-11-02`, // Monday, but outside effective window
          accountId,
          cancelled: true,
        }),
      ).rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('Ad-hoc session (Buổi lẻ)', () => {
    const adHocId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    beforeEach(async () => {
      const adHoc = ClassSession.createAdHoc({
        id: adHocId,
        accountId,
        date: '2026-10-28',
        startTime: '08:00',
        endTime: '09:30',
        subject: 'Toán',
        tone: 'blue',
        cancelled: false,
        now,
      });
      await sessionRepo.save(adHoc);
    });

    it('allows updating all fields on ad-hoc session', async () => {
      clock.set(later);
      const res = await useCase.execute({
        id: adHocId,
        accountId,
        subject: 'Toán nâng cao',
        grade: '12A1',
        room: 'P.102',
        startTime: '08:30',
        endTime: '10:00',
        tone: 'mint',
        topic: 'Ôn tập chương 1',
        prepItems: [{ id: 'p1', label: 'Mang đề', done: false }],
        cancelled: true,
      });

      expect(res.id).toBe(adHocId);
      expect(res.timetableSlotId).toBeNull();
      expect(res.subject).toBe('Toán nâng cao');
      expect(res.grade).toBe('12A1');
      expect(res.room).toBe('P.102');
      expect(res.startTime).toBe('08:30');
      expect(res.endTime).toBe('10:00');
      expect(res.tone).toBe('mint');
      expect(res.topic).toBe('Ôn tập chương 1');
      expect(res.prepItems).toHaveLength(1);
      expect(res.cancelled).toBe(true);
      expect(res.updatedAt).toBe(later.toISOString());
    });

    it('throws EntityNotFoundError when ad-hoc session not found or belongs to another account', async () => {
      await expect(
        useCase.execute({
          id: 'non-existent-id',
          accountId,
          subject: 'Toán',
        }),
      ).rejects.toThrow(EntityNotFoundError);

      await expect(
        useCase.execute({
          id: adHocId,
          accountId: otherAccountId,
          subject: 'Toán',
        }),
      ).rejects.toThrow(EntityNotFoundError);
    });
  });
});
