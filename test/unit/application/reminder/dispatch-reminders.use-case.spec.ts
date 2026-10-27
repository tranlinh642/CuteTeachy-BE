import { DispatchRemindersUseCase } from '../../../../src/application/reminder/dispatch-reminders.use-case';
import { InMemoryTaskReminderReader } from '../../../fakes/in-memory-task-reminder.reader';
import { InMemorySettingsRepository } from '../../../fakes/in-memory-settings.repository';
import { InMemorySentReminderRepository } from '../../../fakes/in-memory-sent-reminder.repository';
import { InMemoryPushSubscriptionRepository } from '../../../fakes/in-memory-push-subscription.repository';
import { FakePushSender } from '../../../fakes/fake-push-sender';
import { FixedClock } from '../../../fakes/fixed-clock';
import { Task } from '../../../../src/domain/task/task.entity';
import { Settings } from '../../../../src/domain/settings/settings.entity';
import { PushSubscription } from '../../../../src/domain/push-subscription/push-subscription.entity';
import { SentReminder } from '../../../../src/domain/reminder/sent-reminder.entity';
import { PurgeSoftDeletedTagsUseCase } from '../../../../src/application/tag/purge-soft-deleted-tags.use-case';

describe('DispatchRemindersUseCase', () => {
  let taskReader: InMemoryTaskReminderReader;
  let settingsRepo: InMemorySettingsRepository;
  let sentReminderRepo: InMemorySentReminderRepository;
  let pushSubRepo: InMemoryPushSubscriptionRepository;
  let fakePushSender: FakePushSender;
  let clock: FixedClock;
  let useCase: DispatchRemindersUseCase;

  const teacherId = 'teacher-uuid-1';
  // Date and times:
  // Date: 2026-10-27
  // Asia/Ho_Chi_Minh is UTC+7
  // Task time: 10:00 local -> 03:00 UTC
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

  beforeEach(async () => {
    taskReader = new InMemoryTaskReminderReader();
    settingsRepo = new InMemorySettingsRepository();
    sentReminderRepo = new InMemorySentReminderRepository();
    pushSubRepo = new InMemoryPushSubscriptionRepository();
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

    useCase = new DispatchRemindersUseCase(
      taskReader,
      settingsRepo,
      sentReminderRepo,
      fakePushSender,
      pushSubRepo,
      clock,
    );
  });

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

    // Advance clock by 8 minutes (latency = 8m <= 10m)
    clock.advance(8 * 60 * 1000);

    const result = await useCase.execute();

    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(fakePushSender.getSentMessages()).toHaveLength(1);
  });

  it('gửi khi trễ đúng 10 phút', async () => {
    const task = createTask();
    taskReader.addTask(task);

    // Advance clock by exactly 10 minutes
    clock.advance(10 * 60 * 1000);

    const result = await useCase.execute();

    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(fakePushSender.getSentMessages()).toHaveLength(1);
  });

  it('bỏ qua khi trễ > 10 phút', async () => {
    const task = createTask();
    taskReader.addTask(task);

    // Advance clock by 10 minutes + 1 second
    clock.advance(10 * 60 * 1000 + 1000);

    const result = await useCase.execute();

    expect(result).toEqual({ sent: 0, skipped: 1 });
    expect(fakePushSender.getSentMessages()).toHaveLength(0);
    expect(sentReminderRepo.getAll()).toHaveLength(0);
  });

  it('chưa đến giờ nhắc (remindAt > now) thì không gửi', async () => {
    const task = createTask();
    taskReader.addTask(task);

    // Clock is 5 minutes before remindAt
    clock.set(new Date(exactRemindTime.getTime() - 5 * 60 * 1000));

    const result = await useCase.execute();

    expect(result).toEqual({ sent: 0, skipped: 1 });
    expect(fakePushSender.getSentMessages()).toHaveLength(0);
  });

  it('idempotent: gọi dispatch 2 lần liên tiếp chỉ gửi 1 lần', async () => {
    const task = createTask();
    taskReader.addTask(task);

    // First dispatch
    const firstResult = await useCase.execute();
    expect(firstResult).toEqual({ sent: 1, skipped: 0 });
    expect(fakePushSender.getSentMessages()).toHaveLength(1);

    // Second dispatch
    const secondResult = await useCase.execute();
    expect(secondResult).toEqual({ sent: 0, skipped: 1 });
    // Still only 1 message sent
    expect(fakePushSender.getSentMessages()).toHaveLength(1);
  });

  it('đổi giờ task -> thời điểm nhắc mới -> gửi theo giờ mới', async () => {
    const task = createTask({ time: '10:00' });
    taskReader.addTask(task);

    // First run at 10:00 remind time
    await useCase.execute();
    expect(fakePushSender.getSentMessages()).toHaveLength(1);

    // Update task to 11:00
    // Remind at 11:00 - 15m = 10:45 local = 03:45 UTC
    const newTask = createTask({ time: '11:00' });
    taskReader.clear();
    taskReader.addTask(newTask);

    // Advance clock to new remind time (03:45 UTC = exactRemindTime + 1 hour)
    clock.advance(60 * 60 * 1000);

    const result = await useCase.execute();
    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(fakePushSender.getSentMessages()).toHaveLength(2);
    expect(fakePushSender.getSentMessages()[1].payload.body).toBe('11:00');
  });

  it('đổi số phút nhắc -> thời điểm nhắc mới -> gửi theo giờ mới', async () => {
    const task = createTask();
    taskReader.addTask(task);

    // Update teacher settings to 30 min lead
    // Task 10:00 local (03:00 UTC) - 30 min = 02:30 UTC
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

    // Set clock to 02:30 UTC
    clock.set(new Date('2026-10-27T02:30:00.000Z'));

    const result = await useCase.execute();
    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(fakePushSender.getSentMessages()).toHaveLength(1);
  });

  it('đổi múi giờ -> thời điểm nhắc mới -> gửi theo giờ mới', async () => {
    const task = createTask();
    taskReader.addTask(task);

    // Change teacher timeZone to UTC
    // Task 10:00 in UTC - 15m = 09:45 UTC
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

    // Set clock to 09:45 UTC
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

  describe('dọn dẹp dữ liệu cũ', () => {
    it('dọn dẹp bản ghi SentReminder cũ hơn 30 ngày', async () => {
      // 31 days old sent reminder
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

      // Recent reminder (2 days ago)
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
        fakePushSender,
        pushSubRepo,
        clock,
        mockPurgeTagsUseCase,
      );

      await useCaseWithPurge.execute();

      expect(mockPurgeTagsUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('hỗ trợ khởi tạo với SendPushToTeacherUseCase trực tiếp', async () => {
      const sendPushUseCase = {
        execute: jest.fn().mockResolvedValue({ total: 1, sent: 1, expired: 0, failed: 0 }),
      } as any;

      const useCaseWithDirectPush = new DispatchRemindersUseCase(
        taskReader,
        settingsRepo,
        sentReminderRepo,
        sendPushUseCase,
        clock,
      );

      const task = createTask();
      taskReader.addTask(task);

      const result = await useCaseWithDirectPush.execute();
      expect(result).toEqual({ sent: 1, skipped: 0 });
      expect(sendPushUseCase.execute).toHaveBeenCalledTimes(1);
    });
  });
});
