import { Clock } from '../shared/ports/clock.port';
import { TeacherSettingsReader } from '../settings/ports/teacher-settings.port';
import { SentReminderRepository } from './ports/sent-reminder.repository.port';
import { TaskReminderReader } from './ports/task-reminder.port';
import { PushSender } from '../push-subscription/ports/push-sender.port';
import { PushSubscriptionRepository } from '../push-subscription/ports/push-subscription.repository.port';
import { SendPushToTeacherUseCase } from '../push-subscription/send-push-to-teacher.use-case';
import { PurgeSoftDeletedTagsUseCase } from '../tag/purge-soft-deleted-tags.use-case';
import { SentReminder } from '../../domain/reminder/sent-reminder.entity';
import { calculateTaskRemindAt } from '../../domain/reminder/reminder-time.calculator';
import { formatTaskReminderNotification } from '../../domain/reminder/reminder-template';
import { DispatchRemindersOutput } from './reminder.dto';

const TEN_MINUTES_MS = 10 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class DispatchRemindersUseCase {
  private readonly sendPushUseCase: SendPushToTeacherUseCase;
  private readonly clock: Clock;
  private readonly purgeSoftDeletedTagsUseCase?: PurgeSoftDeletedTagsUseCase;

  constructor(
    private readonly taskReader: TaskReminderReader,
    private readonly settingsReader: TeacherSettingsReader,
    private readonly sentReminderRepo: SentReminderRepository,
    pushSenderOrUseCase: PushSender | SendPushToTeacherUseCase,
    pushSubscriptionRepoOrClock: PushSubscriptionRepository | Clock,
    clockOrPurge?: Clock | PurgeSoftDeletedTagsUseCase,
    purgeSoftDeletedTagsUseCase?: PurgeSoftDeletedTagsUseCase,
  ) {
    const isSendPushUseCase =
      pushSenderOrUseCase instanceof SendPushToTeacherUseCase ||
      (typeof (pushSenderOrUseCase as any)?.execute === 'function' &&
        typeof (pushSenderOrUseCase as any)?.getVapidPublicKey !== 'function');

    if (isSendPushUseCase) {
      this.sendPushUseCase = pushSenderOrUseCase as SendPushToTeacherUseCase;
      this.clock = pushSubscriptionRepoOrClock as Clock;
      this.purgeSoftDeletedTagsUseCase = clockOrPurge as PurgeSoftDeletedTagsUseCase | undefined;
    } else {
      const sender = pushSenderOrUseCase as PushSender;
      const subRepo = pushSubscriptionRepoOrClock as PushSubscriptionRepository;
      this.sendPushUseCase = new SendPushToTeacherUseCase(subRepo, sender);
      this.clock = clockOrPurge as Clock;
      this.purgeSoftDeletedTagsUseCase = purgeSoftDeletedTagsUseCase;
    }
  }

  async execute(): Promise<DispatchRemindersOutput> {
    const now = this.clock.now();

    // 1. Housekeeping: cleanup old sent reminders (> 30 days) and soft-deleted tags
    try {
      const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);
      await this.sentReminderRepo.deletePermanentlyBefore(thirtyDaysAgo);
    } catch {
      // Non-blocking cleanup
    }

    if (this.purgeSoftDeletedTagsUseCase) {
      try {
        await this.purgeSoftDeletedTagsUseCase.execute();
      } catch {
        // Non-blocking cleanup
      }
    }

    // 2. Fetch candidate tasks
    const tasks = await this.taskReader.findUpcomingTasks();

    let sentCount = 0;
    let skippedCount = 0;

    const tenMinutesAgo = new Date(now.getTime() - TEN_MINUTES_MS);

    for (const task of tasks) {
      // Condition: task has time, not completed, not deleted
      if (!task.time || task.completed || task.deletedAt !== null) {
        skippedCount++;
        continue;
      }

      // Teacher settings
      const settings = await this.settingsReader.getSettings(task.accountId);
      if (!settings || !settings.pushEnabled) {
        skippedCount++;
        continue;
      }

      // Calculate remindAt
      let remindAt: Date;
      try {
        remindAt = calculateTaskRemindAt(
          task.date,
          task.time,
          settings.timeZone,
          settings.reminderLeadMinutes,
        );
      } catch {
        skippedCount++;
        continue;
      }

      // Check window: remindAt ∈ (now - 10 minutes, now]
      // That is: remindAt <= now AND remindAt >= tenMinutesAgo
      if (remindAt.getTime() > now.getTime() || remindAt.getTime() < tenMinutesAgo.getTime()) {
        skippedCount++;
        continue;
      }

      // Idempotency check: has this reminder already been sent?
      const alreadySent = await this.sentReminderRepo.exists('task', task.id, remindAt);
      if (alreadySent) {
        skippedCount++;
        continue;
      }

      // Format notification payload according to teacher locale
      const payload = formatTaskReminderNotification(settings.locale, {
        id: task.id,
        title: task.title,
        time: task.time,
        date: task.date,
      });

      // Send push notification to teacher's devices
      const pushResult = await this.sendPushUseCase.execute({
        accountId: task.accountId,
        payload,
      });

      if (pushResult.sent > 0) {
        const sentRecord = SentReminder.create({
          type: 'task',
          targetId: task.id,
          remindAt,
          accountId: task.accountId,
          now,
        });

        await this.sentReminderRepo.save(sentRecord);
        sentCount++;
      } else {
        skippedCount++;
      }
    }

    return {
      sent: sentCount,
      skipped: skippedCount,
    };
  }
}
