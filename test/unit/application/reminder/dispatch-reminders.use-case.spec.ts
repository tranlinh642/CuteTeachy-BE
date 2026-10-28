import { DispatchRemindersUseCase } from '../../../../src/application/reminder/dispatch-reminders.use-case';
import { InMemoryTaskReminderReader } from '../../../fakes/in-memory-task-reminder.reader';
import { InMemorySettingsRepository } from '../../../fakes/in-memory-settings.repository';
import { InMemorySentReminderRepository } from '../../../fakes/in-memory-sent-reminder.repository';
import { InMemoryPushSubscriptionRepository } from '../../../fakes/in-memory-push-subscription.repository';
import { InMemoryTimetableSlotRepository } from '../../../fakes/in-memory-timetable-slot.repository';
import { InMemoryClassSessionRepository } from '../../../fakes/in-memory-class-session.repository';
import { FakePushSender } from '../../../fakes/fake-push-sender';
import { FixedClock } from '../../../fakes/fixed-clock';
import { Task } from '../../../../src/domain/task/task.entity';
import { Settings } from '../../../../src/domain/settings/settings.entity';
import { PushSubscription } from '../../../../src/domain/push-subscription/push-subscription.entity';
import { SentReminder } from '../../../../src/domain/reminder/sent-reminder.entity';
import { TimetableSlot } from '../../../../src/domain/timetable/timetable-slot.entity';
import { ClassSession } from '../../../../src/domain/class-session/class-session.entity';
import { PurgeSoftDeletedTagsUseCase } from '../../../../src/application/tag/purge-soft-deleted-tags.use-case';
import { PurgeSoftDeletedTasksUseCase } from '../../../../src/application/task/purge-soft-deleted-tasks.use-case';
import { SendPushToTeacherUseCase } from '../../../../src/application/push-subscription/send-push-to-teacher.use-case';
import { IdGenerator } from '../../../../src/application/shared/ports/id-generator.port';

describe('DispatchRemindersUseCase', () => {
  let taskReader: InMemoryTaskReminderReader;
  let settingsRepo: InMemorySettingsRepository;
  let sentReminderRepo: InMemorySentReminderRepository;
  let pushSubRepo: InMemoryPushSubscriptionRepository;
  let slotRepo: InMemoryTimetableSlotRepository;
  let sessionRepo: InMemoryClassSessionRepository;
  let fakePushSender: FakePushSender;
  let clock: FixedClock;
  let sendPushUseCase!: SendPushToTeacherUseCase;
  let idGenerator!: IdGenerator;
  let useCase: DispatchRemindersUseCase;

  const teacherId = 'teacher-uuid-1';
  // Date and times:
  // Date: 2026-10-27 (Tuesday -> weekday 2)
  // Asia/Ho_Chi_Minh is UTC+7
  // Task/Session time: 10:00 local -> 03:00 UTC
  // Lead: 15 min -> remindAt: 02:45 UTC = 2026-10-27T02:45:00.000Z
  const exactRemindTime = new Date('2026-10-27T02:45:00.000Z');

  const baseKeys = {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  };

  function createTask(props?: {
    id?: string;
    accountId?: string;
    title?: string;
    date?: string;
    time?: string | null;
    completed?: boolean;
    deletedAt?: Date | null;
  }): Task {
    return Task.reconstitute({
      id: props?.id ?? 'task-1',
      accountId: props?.accountId ?? teacherId,
      title: props?.title ?? 'Chuẩn bị bài giảng',
      notes: null,
      date: props?.date ?? '2026-10-27',
      time: props?.time !== undefined ? props.time : '10:00',
      category: 'school',
      priority: 'normal',
      completed: props?.completed ?? false,
      tagIds: [],
      createdAt: new Date('2026-10-26T00:00:00.000Z'),
      updatedAt: new Date('2026-10-26T00:00:00.000Z'),
      deletedAt: props?.deletedAt ?? null,
    });
  }

  function createSlot(props?: {
    id?: string;
    accountId?: string;
    weekday?: number;
    startTime?: string;
    endTime?: string;
    subject?: string;
    grade?: string | null;
    room?: string | null;
    effectiveFrom?: string;
    effectiveTo?: string | null;
  }): TimetableSlot {
    return TimetableSlot.create({
      id: props?.id ?? '00000000-0000-4000-8000-000000000001',
      accountId: props?.accountId ?? teacherId,
      weekday: props?.weekday ?? 2, // Tuesday (2026-10-27 is Tuesday)
      startTime: props?.startTime ?? '10:00',
      endTime: props?.endTime ?? '10:45',
      subject: props?.subject ?? 'Sinh học',
      grade: props?.grade !== undefined ? props.grade : '10A',
      room: props?.room !== undefined ? props.room : '302',
      tone: 'blue',
      effectiveFrom: props?.effectiveFrom ?? '2026-10-01',
      effectiveTo: props?.effectiveTo ?? null,
      now: exactRemindTime,
    });
  }

  function createAdHocSession(props?: {
    id?: string;
    accountId?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    subject?: string;
    grade?: string | null;
    room?: string | null;
    cancelled?: boolean;
    deletedAt?: Date | null;
  }): ClassSession {
    const session = ClassSession.createAdHoc({
      id: props?.id ?? '00000000-0000-4000-8000-000000000002',
      accountId: props?.accountId ?? teacherId,
      date: props?.date ?? '2026-10-27',
      startTime: props?.startTime ?? '10:00',
      endTime: props?.endTime ?? '10:45',
      subject: props?.subject ?? 'Dạy bù Vật lý',
      grade: props?.grade !== undefined ? props.grade : '11B',
      room: props?.room !== undefined ? props.room : '101',
      tone: 'mint',
      cancelled: props?.cancelled ?? false,
      now: exactRemindTime,
    });
    if (props?.deletedAt) {
      session.delete(props.deletedAt);
    }
    return session;
  }

  beforeEach(async () => {
    taskReader = new InMemoryTaskReminderReader();
    settingsRepo = new InMemorySettingsRepository();
    sentReminderRepo = new InMemorySentReminderRepository();
    pushSubRepo = new InMemoryPushSubscriptionRepository();
    slotRepo = new InMemoryTimetableSlotRepository();
    sessionRepo = new InMemoryClassSessionRepository();
    fakePushSender = new FakePushSender();
    clock = new FixedClock(exactRemindTime);

    // Setup teacher settings
    const settings = Settings.reconstitute({
      id: 'settings-1',
      accountId: teacherId,
      locale: 'vi',
      timeZone: 'Asia/Ho_Chi_Minh',
      pushEnabled: true,
      reminderLeadMinutes: 15,
      createdAt: new Date('2026-10-20T00:00:00.000Z'),
      updatedAt: new Date('2026-10-20T00:00:00.000Z'),
    });
    await settingsRepo.save(settings);

    // Setup teacher push subscription
    const sub = PushSubscription.create({
      id: 'sub-1',
      accountId: teacherId,
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
      keys: baseKeys,
      now: exactRemindTime,
    });
    await pushSubRepo.save(sub);

    let idCounter = 1;
    idGenerator = {
      next: () => `sent-id-${idCounter++}`,
      generate: () => `sent-id-${idCounter++}`,
    };
    sendPushUseCase = new SendPushToTeacherUseCase(pushSubRepo, fakePushSender);

    useCase = new DispatchRemindersUseCase(
      taskReader,
      settingsRepo,
      sentReminderRepo,
      sendPushUseCase,
      clock,
      idGenerator,
      slotRepo,
      sessionRepo,
    );
  });

  describe('Task Reminders', () => {
    it('gửi đúng giờ khi now trùng khớp remindAt', async () => {
      const task = createTask();
      taskReader.addTask(task);

      const result = await useCase.execute();

      expect(result).toEqual({ sent: 1, skipped: 0 });
      expect(fakePushSender.getSentMessages()).toHaveLength(1);
      expect(fakePushSender.getSentMessages()[0].payload.title).toBe(
        'Nhắc nhở công việc: Chuẩn bị bài giảng',
      );
      expect(fakePushSender.getSentMessages()[0].payload.body).toBe('10:00');
      expect(fakePushSender.getSentMessages()[0].payload.url).toBe('/tasks?date=2026-10-27');

      const sentRecords = sentReminderRepo.getAll();
      expect(sentRecords).toHaveLength(1);
      expect(sentRecords[0].type).toBe('task');
      expect(sentRecords[0].targetId).toBe('task-1');
      expect(sentRecords[0].remindAt).toEqual(exactRemindTime);
    });

    it('gửi khi trễ <= 10 phút', async () => {
      const task = createTask();
      taskReader.addTask(task);

      clock.advance(8 * 60 * 1000);

      const result = await useCase.execute();

      expect(result).toEqual({ sent: 1, skipped: 0 });
      expect(fakePushSender.getSentMessages()).toHaveLength(1);
    });

    it('gửi khi trễ đúng 10 phút', async () => {
      const task = createTask();
      taskReader.addTask(task);

      clock.advance(10 * 60 * 1000);

      const result = await useCase.execute();

      expect(result).toEqual({ sent: 1, skipped: 0 });
      expect(fakePushSender.getSentMessages()).toHaveLength(1);
    });

    it('bỏ qua khi trễ > 10 phút', async () => {
      const task = createTask();
      taskReader.addTask(task);

      clock.advance(10 * 60 * 1000 + 1000);

      const result = await useCase.execute();

      expect(result).toEqual({ sent: 0, skipped: 1 });
      expect(fakePushSender.getSentMessages()).toHaveLength(0);
      expect(sentReminderRepo.getAll()).toHaveLength(0);
    });

    it('chưa đến giờ nhắc (remindAt > now) thì không gửi', async () => {
      const task = createTask();
      taskReader.addTask(task);

      clock.set(new Date(exactRemindTime.getTime() - 5 * 60 * 1000));

      const result = await useCase.execute();

      expect(result).toEqual({ sent: 0, skipped: 1 });
      expect(fakePushSender.getSentMessages()).toHaveLength(0);
    });

    it('idempotent: gọi dispatch 2 lần liên tiếp chỉ gửi 1 lần', async () => {
      const task = createTask();
      taskReader.addTask(task);

      const firstResult = await useCase.execute();
      expect(firstResult).toEqual({ sent: 1, skipped: 0 });
      expect(fakePushSender.getSentMessages()).toHaveLength(1);

      const secondResult = await useCase.execute();
      expect(secondResult).toEqual({ sent: 0, skipped: 1 });
      expect(fakePushSender.getSentMessages()).toHaveLength(1);
    });

    it('đổi giờ task -> thời điểm nhắc mới -> gửi theo giờ mới', async () => {
      const task = createTask({ time: '10:00' });
      taskReader.addTask(task);

      await useCase.execute();
      expect(fakePushSender.getSentMessages()).toHaveLength(1);

      const newTask = createTask({ time: '11:00' });
      taskReader.clear();
      taskReader.addTask(newTask);

      clock.advance(60 * 60 * 1000);

      const result = await useCase.execute();
      expect(result).toEqual({ sent: 1, skipped: 0 });
      expect(fakePushSender.getSentMessages()).toHaveLength(2);
      expect(fakePushSender.getSentMessages()[1].payload.body).toBe('11:00');
    });

    it('đổi số phút nhắc -> thời điểm nhắc mới -> gửi theo giờ mới', async () => {
      const task = createTask();
      taskReader.addTask(task);

      const newSettings = Settings.reconstitute({
        id: 'settings-1',
        accountId: teacherId,
        locale: 'vi',
        timeZone: 'Asia/Ho_Chi_Minh',
        pushEnabled: true,
        reminderLeadMinutes: 30,
        createdAt: new Date('2026-10-20T00:00:00.000Z'),
        updatedAt: new Date('2026-10-20T00:00:00.000Z'),
      });
      await settingsRepo.save(newSettings);

      clock.set(new Date('2026-10-27T02:30:00.000Z'));

      const result = await useCase.execute();
      expect(result).toEqual({ sent: 1, skipped: 0 });
      expect(fakePushSender.getSentMessages()).toHaveLength(1);
    });

    it('đổi múi giờ -> thời điểm nhắc mới -> gửi theo giờ mới', async () => {
      const task = createTask();
      taskReader.addTask(task);

      const newSettings = Settings.reconstitute({
        id: 'settings-1',
        accountId: teacherId,
        locale: 'vi',
        timeZone: 'UTC',
        pushEnabled: true,
        reminderLeadMinutes: 15,
        createdAt: new Date('2026-10-20T00:00:00.000Z'),
        updatedAt: new Date('2026-10-20T00:00:00.000Z'),
      });
      await settingsRepo.save(newSettings);

      clock.set(new Date('2026-10-27T09:45:00.000Z'));

      const result = await useCase.execute();
      expect(result).toEqual({ sent: 1, skipped: 0 });
      expect(fakePushSender.getSentMessages()).toHaveLength(1);
    });

    describe('không gửi khi không thỏa mãn điều kiện', () => {
      it('không gửi khi task không có time', async () => {
        const task = createTask({ time: null });
        taskReader.addTask(task);

        const result = await useCase.execute();
        expect(result).toEqual({ sent: 0, skipped: 1 });
        expect(fakePushSender.getSentMessages()).toHaveLength(0);
      });

      it('không gửi khi task đã hoàn thành (completed = true)', async () => {
        const task = createTask({ completed: true });
        taskReader.addTask(task);

        const result = await useCase.execute();
        expect(result).toEqual({ sent: 0, skipped: 1 });
        expect(fakePushSender.getSentMessages()).toHaveLength(0);
      });

      it('không gửi khi task đã bị xóa mềm (deletedAt != null)', async () => {
        const task = createTask({ deletedAt: new Date() });
        taskReader.addTask(task);

        const result = await useCase.execute();
        expect(result).toEqual({ sent: 0, skipped: 1 });
        expect(fakePushSender.getSentMessages()).toHaveLength(0);
      });

      it('không gửi khi teacher tắt pushEnabled (pushEnabled = false)', async () => {
        const task = createTask();
        taskReader.addTask(task);

        const disabledSettings = Settings.reconstitute({
          id: 'settings-1',
          accountId: teacherId,
          locale: 'vi',
          timeZone: 'Asia/Ho_Chi_Minh',
          pushEnabled: false,
          reminderLeadMinutes: 15,
          createdAt: new Date('2026-10-20T00:00:00.000Z'),
          updatedAt: new Date('2026-10-20T00:00:00.000Z'),
        });
        await settingsRepo.save(disabledSettings);

        const result = await useCase.execute();
        expect(result).toEqual({ sent: 0, skipped: 1 });
        expect(fakePushSender.getSentMessages()).toHaveLength(0);
      });
    });

    describe('nội dung theo locale', () => {
      it('nội dung đúng với locale vi', async () => {
        const task = createTask({ title: 'Họp tổ bộ môn' });
        taskReader.addTask(task);

        await useCase.execute();

        expect(fakePushSender.getSentMessages()[0].payload).toEqual({
          title: 'Nhắc nhở công việc: Họp tổ bộ môn',
          body: '10:00',
          url: '/tasks?date=2026-10-27',
          data: {
            type: 'task',
            id: 'task-1',
            date: '2026-10-27',
            url: '/tasks?date=2026-10-27',
          },
        });
      });

      it('nội dung đúng với locale en', async () => {
        const enSettings = Settings.reconstitute({
          id: 'settings-1',
          accountId: teacherId,
          locale: 'en',
          timeZone: 'Asia/Ho_Chi_Minh',
          pushEnabled: true,
          reminderLeadMinutes: 15,
          createdAt: new Date('2026-10-20T00:00:00.000Z'),
          updatedAt: new Date('2026-10-20T00:00:00.000Z'),
        });
        await settingsRepo.save(enSettings);

        const task = createTask({ title: 'Department meeting' });
        taskReader.addTask(task);

        await useCase.execute();

        expect(fakePushSender.getSentMessages()[0].payload).toEqual({
          title: 'Task reminder: Department meeting',
          body: '10:00',
          url: '/tasks?date=2026-10-27',
          data: {
            type: 'task',
            id: 'task-1',
            date: '2026-10-27',
            url: '/tasks?date=2026-10-27',
          },
        });
      });
    });
  });

  describe('Class Session Reminders (S5-BE-03)', () => {
    it('buổi sinh từ timetable slot: gửi đúng giờ, đúng payload, lưu SentReminder với type class_session', async () => {
      const slot = createSlot();
      await slotRepo.save(slot);

      const result = await useCase.execute();

      expect(result).toEqual({ sent: 1, skipped: 0 });
      expect(fakePushSender.getSentMessages()).toHaveLength(1);
      const sentMsg = fakePushSender.getSentMessages()[0];
      expect(sentMsg.payload).toEqual({
        title: 'Tiết dạy: Sinh học 10A',
        body: 'Bắt đầu lúc 10:00 tại Phòng 302',
        url: '/timetable?date=2026-10-27',
        data: {
          type: 'class_session',
          id: '00000000-0000-4000-8000-000000000001:2026-10-27',
          date: '2026-10-27',
          url: '/timetable?date=2026-10-27',
        },
      });

      const sentRecords = sentReminderRepo.getAll();
      expect(sentRecords).toHaveLength(1);
      expect(sentRecords[0].type).toBe('class_session');
      expect(sentRecords[0].targetId).toBe('00000000-0000-4000-8000-000000000001:2026-10-27');
      expect(sentRecords[0].remindAt).toEqual(exactRemindTime);
    });

    it('buổi lẻ (ad-hoc): được nhắc tương tự như buổi sinh từ slot', async () => {
      const adHoc = createAdHocSession();
      await sessionRepo.save(adHoc);

      const result = await useCase.execute();

      expect(result).toEqual({ sent: 1, skipped: 0 });
      expect(fakePushSender.getSentMessages()).toHaveLength(1);
      const sentMsg = fakePushSender.getSentMessages()[0];
      expect(sentMsg.payload).toEqual({
        title: 'Tiết dạy: Dạy bù Vật lý 11B',
        body: 'Bắt đầu lúc 10:00 tại Phòng 101',
        url: '/timetable?date=2026-10-27',
        data: {
          type: 'class_session',
          id: '00000000-0000-4000-8000-000000000002',
          date: '2026-10-27',
          url: '/timetable?date=2026-10-27',
        },
      });

      const sentRecords = sentReminderRepo.getAll();
      expect(sentRecords).toHaveLength(1);
      expect(sentRecords[0].type).toBe('class_session');
      expect(sentRecords[0].targetId).toBe('00000000-0000-4000-8000-000000000002');
      expect(sentRecords[0].remindAt).toEqual(exactRemindTime);
    });

    describe('buổi bị huỷ (cancelled) hoặc xoá mềm -> không gửi', () => {
      it('buổi sinh từ slot có override huỷ (cancelled = true) -> không gửi', async () => {
        const slot = createSlot();
        await slotRepo.save(slot);

        const override = ClassSession.createOverride({
          accountId: teacherId,
          timetableSlotId: slot.id,
          date: '2026-10-27',
          cancelled: true,
          now: exactRemindTime,
        });
        await sessionRepo.save(override);

        const result = await useCase.execute();

        expect(result).toEqual({ sent: 0, skipped: 1 });
        expect(fakePushSender.getSentMessages()).toHaveLength(0);
        expect(sentReminderRepo.getAll()).toHaveLength(0);
      });

      it('buổi lẻ có cancelled = true -> không gửi', async () => {
        const adHoc = createAdHocSession({ cancelled: true });
        await sessionRepo.save(adHoc);

        const result = await useCase.execute();

        expect(result).toEqual({ sent: 0, skipped: 1 });
        expect(fakePushSender.getSentMessages()).toHaveLength(0);
        expect(sentReminderRepo.getAll()).toHaveLength(0);
      });

      it('buổi lẻ bị xoá mềm (deletedAt != null) -> không gửi', async () => {
        const adHoc = createAdHocSession({ deletedAt: exactRemindTime });
        await sessionRepo.save(adHoc);

        const result = await useCase.execute();

        expect(result).toEqual({ sent: 0, skipped: 0 });
        expect(fakePushSender.getSentMessages()).toHaveLength(0);
        expect(sentReminderRepo.getAll()).toHaveLength(0);
      });
    });

    describe('buổi đổi giờ -> nhắc theo giờ mới', () => {
      it('buổi ghi đè đổi giờ -> nhắc theo giờ mới', async () => {
        const slot = createSlot({ startTime: '10:00', endTime: '10:45' });
        await slotRepo.save(slot);

        // Override changes time to 11:00
        const override = ClassSession.rehydrate({
          id: `${slot.id}:2026-10-27`,
          accountId: teacherId,
          timetableSlotId: slot.id,
          date: '2026-10-27',
          startTime: '11:00',
          endTime: '11:45',
          subject: 'Sinh học',
          grade: '10A',
          room: '302',
          tone: null,
          topic: null,
          prepItems: [],
          cancelled: false,
          createdAt: exactRemindTime,
          updatedAt: exactRemindTime,
        });
        await sessionRepo.save(override);

        // At 02:45 UTC (10:00 local - 15m), the session was moved to 11:00 (due at 03:45 UTC)
        const initialResult = await useCase.execute();
        expect(initialResult).toEqual({ sent: 0, skipped: 1 });
        expect(fakePushSender.getSentMessages()).toHaveLength(0);

        // Advance clock by 1 hour to 03:45 UTC
        clock.advance(60 * 60 * 1000);

        const result = await useCase.execute();
        expect(result).toEqual({ sent: 1, skipped: 0 });
        expect(fakePushSender.getSentMessages()).toHaveLength(1);
        expect(fakePushSender.getSentMessages()[0].payload.body).toBe('Bắt đầu lúc 11:00 tại Phòng 302');
      });

      it('buổi lẻ đổi giờ -> nhắc theo giờ mới', async () => {
        const adHoc = createAdHocSession({ startTime: '10:00' });
        await sessionRepo.save(adHoc);

        // First run at 10:00 remind time
        await useCase.execute();
        expect(fakePushSender.getSentMessages()).toHaveLength(1);

        // Update ad-hoc to 11:00
        adHoc.updateAdHoc({ startTime: '11:00', endTime: '11:45', now: exactRemindTime });
        await sessionRepo.save(adHoc);

        // Advance clock to new remind time (03:45 UTC)
        clock.advance(60 * 60 * 1000);

        const result = await useCase.execute();
        expect(result).toEqual({ sent: 1, skipped: 0 });
        expect(fakePushSender.getSentMessages()).toHaveLength(2);
        expect(fakePushSender.getSentMessages()[1].payload.body).toContain('11:00');
      });
    });

    it('slot hết hiệu lực (effectiveTo < today) -> không gửi', async () => {
      // Slot expired on 2026-10-20 (today is 2026-10-27)
      const expiredSlot = createSlot({
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-10-20',
      });
      await slotRepo.save(expiredSlot);

      const result = await useCase.execute();

      expect(result).toEqual({ sent: 0, skipped: 0 });
      expect(fakePushSender.getSentMessages()).toHaveLength(0);
    });

    it('đổi múi giờ giáo viên -> tính theo múi giờ mới', async () => {
      const slot = createSlot({ startTime: '10:00' });
      await slotRepo.save(slot);

      // Teacher changes timeZone to UTC
      // 10:00 in UTC - 15m = 09:45 UTC
      const newSettings = Settings.reconstitute({
        id: 'settings-1',
        accountId: teacherId,
        locale: 'vi',
        timeZone: 'UTC',
        pushEnabled: true,
        reminderLeadMinutes: 15,
        createdAt: new Date('2026-10-20T00:00:00.000Z'),
        updatedAt: new Date('2026-10-20T00:00:00.000Z'),
      });
      await settingsRepo.save(newSettings);

      // At 02:45 UTC: not due yet in UTC
      const initialResult = await useCase.execute();
      expect(initialResult).toEqual({ sent: 0, skipped: 1 });
      expect(fakePushSender.getSentMessages()).toHaveLength(0);

      // Move clock to 09:45 UTC
      clock.set(new Date('2026-10-27T09:45:00.000Z'));

      const result = await useCase.execute();
      expect(result).toEqual({ sent: 1, skipped: 0 });
      expect(fakePushSender.getSentMessages()).toHaveLength(1);
    });

    it('dispatch 2 lần liên tiếp -> chỉ gửi 1 lần (idempotent)', async () => {
      const slot = createSlot();
      await slotRepo.save(slot);

      const firstResult = await useCase.execute();
      expect(firstResult).toEqual({ sent: 1, skipped: 0 });
      expect(fakePushSender.getSentMessages()).toHaveLength(1);

      const secondResult = await useCase.execute();
      expect(secondResult).toEqual({ sent: 0, skipped: 1 });
      expect(fakePushSender.getSentMessages()).toHaveLength(1);
    });

    it('nội dung đúng với locale en cho class session', async () => {
      const enSettings = Settings.reconstitute({
        id: 'settings-1',
        accountId: teacherId,
        locale: 'en',
        timeZone: 'Asia/Ho_Chi_Minh',
        pushEnabled: true,
        reminderLeadMinutes: 15,
        createdAt: new Date('2026-10-20T00:00:00.000Z'),
        updatedAt: new Date('2026-10-20T00:00:00.000Z'),
      });
      await settingsRepo.save(enSettings);

      const slot = createSlot({
        subject: 'Biology',
        grade: '10A',
        room: 'Room 302',
      });
      await slotRepo.save(slot);

      await useCase.execute();

      expect(fakePushSender.getSentMessages()[0].payload).toEqual({
        title: 'Class session: Biology 10A',
        body: 'Starts at 10:00 in Room 302',
        url: '/timetable?date=2026-10-27',
        data: {
          type: 'class_session',
          id: '00000000-0000-4000-8000-000000000001:2026-10-27',
          date: '2026-10-27',
          url: '/timetable?date=2026-10-27',
        },
      });
    });

    it('không gửi khi giáo viên tắt push (pushEnabled = false)', async () => {
      const slot = createSlot();
      await slotRepo.save(slot);

      const disabledSettings = Settings.reconstitute({
        id: 'settings-1',
        accountId: teacherId,
        locale: 'vi',
        timeZone: 'Asia/Ho_Chi_Minh',
        pushEnabled: false,
        reminderLeadMinutes: 15,
        createdAt: new Date('2026-10-20T00:00:00.000Z'),
        updatedAt: new Date('2026-10-20T00:00:00.000Z'),
      });
      await settingsRepo.save(disabledSettings);

      const result = await useCase.execute();
      expect(result).toEqual({ sent: 0, skipped: 0 });
      expect(fakePushSender.getSentMessages()).toHaveLength(0);
    });

    it('khối lượng trả lời nhanh: xử lý hàng chục slots và sessions trong thời gian ngắn', async () => {
      for (let i = 0; i < 30; i++) {
        const paddedIndex = String(i + 10).padStart(12, '0');
        const slot = TimetableSlot.create({
          id: `00000000-0000-4000-8000-${paddedIndex}`,
          accountId: teacherId,
          weekday: 2,
          startTime: '10:00',
          endTime: '10:45',
          subject: `Môn học ${i}`,
          grade: '10A',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          now: exactRemindTime,
        });
        await slotRepo.save(slot);
      }

      const start = Date.now();
      const result = await useCase.execute();
      const durationMs = Date.now() - start;

      expect(result.sent).toBe(30);
      expect(durationMs).toBeLessThan(500); // Must be very fast (< 500ms)
    });
  });

  describe('dọn dẹp dữ liệu cũ', () => {
    it('dọn dẹp bản ghi SentReminder cũ hơn 30 ngày', async () => {
      const oldSentAt = new Date(exactRemindTime.getTime() - 31 * 24 * 60 * 60 * 1000);
      const oldReminder = SentReminder.reconstitute({
        id: 'old-1',
        type: 'task',
        targetId: 'old-task',
        remindAt: oldSentAt,
        sentAt: oldSentAt,
        accountId: teacherId,
      });
      await sentReminderRepo.save(oldReminder);

      const recentSentAt = new Date(exactRemindTime.getTime() - 2 * 24 * 60 * 60 * 1000);
      const recentReminder = SentReminder.reconstitute({
        id: 'recent-1',
        type: 'task',
        targetId: 'recent-task',
        remindAt: recentSentAt,
        sentAt: recentSentAt,
        accountId: teacherId,
      });
      await sentReminderRepo.save(recentReminder);

      expect(sentReminderRepo.getAll()).toHaveLength(2);

      await useCase.execute();

      const remaining = sentReminderRepo.getAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('recent-1');
    });

    it('gọi PurgeSoftDeletedTagsUseCase nếu có', async () => {
      const mockPurgeTagsUseCase = {
        execute: jest.fn().mockResolvedValue({ purgedCount: 5 }),
      } as unknown as PurgeSoftDeletedTagsUseCase;

      const useCaseWithPurge = new DispatchRemindersUseCase(
        taskReader,
        settingsRepo,
        sentReminderRepo,
        sendPushUseCase,
        clock,
        idGenerator,
        slotRepo,
        sessionRepo,
        mockPurgeTagsUseCase,
      );

      await useCaseWithPurge.execute();

      expect(mockPurgeTagsUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('gọi PurgeSoftDeletedTasksUseCase nếu có', async () => {
      const mockPurgeTasksUseCase = {
        execute: jest.fn().mockResolvedValue({ purgedCount: 3 }),
      } as unknown as PurgeSoftDeletedTasksUseCase;

      const useCaseWithPurgeTasks = new DispatchRemindersUseCase(
        taskReader,
        settingsRepo,
        sentReminderRepo,
        sendPushUseCase,
        clock,
        idGenerator,
        slotRepo,
        sessionRepo,
        undefined,
        mockPurgeTasksUseCase,
      );

      await useCaseWithPurgeTasks.execute();

      expect(mockPurgeTasksUseCase.execute).toHaveBeenCalledTimes(1);
    });
  });
});
