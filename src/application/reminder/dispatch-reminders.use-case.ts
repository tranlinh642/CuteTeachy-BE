import { Clock } from '../shared/ports/clock.port';
import { TeacherSettingsReader } from '../settings/ports/teacher-settings.port';
import { SentReminderRepository } from './ports/sent-reminder.repository.port';
import { TaskReminderReader } from './ports/task-reminder.port';
import { PushSender } from '../push-subscription/ports/push-sender.port';
import { PushSubscriptionRepository } from '../push-subscription/ports/push-subscription.repository.port';
import { SendPushToTeacherUseCase } from '../push-subscription/send-push-to-teacher.use-case';
import { PurgeSoftDeletedTagsUseCase } from '../tag/purge-soft-deleted-tags.use-case';
import { TimetableSlotRepository } from '../timetable/ports/timetable-slot.repository.port';
import { ClassSessionRepository } from '../class-session/ports/class-session.repository.port';
import { SentReminder } from '../../domain/reminder/sent-reminder.entity';
import {
  calculateClassSessionRemindAt,
  calculateTaskRemindAt,
} from '../../domain/reminder/reminder-time.calculator';
import {
  formatClassSessionReminderNotification,
  formatTaskReminderNotification,
} from '../../domain/reminder/reminder-template';
import { calculateTeacherToday } from '../../domain/settings/teacher-today.helper';
import { generateClassSessions } from '../../domain/class-session/class-session-generator';
import { ClassSession } from '../../domain/class-session/class-session.entity';
import { DispatchRemindersOutput } from './reminder.dto';

const TEN_MINUTES_MS = 10 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class DispatchRemindersUseCase {
  private readonly sendPushUseCase: SendPushToTeacherUseCase;
  private readonly clock: Clock;
  private readonly purgeSoftDeletedTagsUseCase?: PurgeSoftDeletedTagsUseCase;
  private readonly slotRepo?: TimetableSlotRepository;
  private readonly sessionRepo?: ClassSessionRepository;

  constructor(
    private readonly taskReader: TaskReminderReader,
    private readonly settingsReader: TeacherSettingsReader,
    private readonly sentReminderRepo: SentReminderRepository,
    ...args: any[]
  ) {
    const firstArg = args[0];
    const isSendPushUseCase =
      firstArg instanceof SendPushToTeacherUseCase ||
      (typeof firstArg?.execute === 'function' &&
        typeof firstArg?.getVapidPublicKey !== 'function' &&
        typeof firstArg?.send !== 'function');

    let remainingArgs: any[];
    if (isSendPushUseCase) {
      this.sendPushUseCase = firstArg as SendPushToTeacherUseCase;
      this.clock = args[1] as Clock;
      remainingArgs = args.slice(2);
    } else {
      const sender = firstArg as PushSender;
      const subRepo = args[1] as PushSubscriptionRepository;
      this.sendPushUseCase = new SendPushToTeacherUseCase(subRepo, sender);
      this.clock = args[2] as Clock;
      remainingArgs = args.slice(3);
    }

    for (const arg of remainingArgs) {
      if (!arg) continue;
      if (typeof arg.findActiveByAccount === 'function') {
        this.slotRepo = arg as TimetableSlotRepository;
      } else if (typeof arg.findByAccountAndDateRange === 'function') {
        this.sessionRepo = arg as ClassSessionRepository;
      } else if (
        typeof arg.execute === 'function' &&
        typeof arg.findActiveByAccount !== 'function' &&
        typeof arg.findByAccountAndDateRange !== 'function'
      ) {
        this.purgeSoftDeletedTagsUseCase = arg as PurgeSoftDeletedTagsUseCase;
      }
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

    let sentCount = 0;
    let skippedCount = 0;

    const tenMinutesAgo = new Date(now.getTime() - TEN_MINUTES_MS);

    // 2. Fetch candidate tasks
    const tasks = await this.taskReader.findUpcomingTasks();

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

    // 3. Candidate Class Sessions (SPEC-004 + SPEC-005)
    if (this.slotRepo && this.sessionRepo) {
      const pushTeachers =
        typeof this.settingsReader.findPushEnabledTeachers === 'function'
          ? await this.settingsReader.findPushEnabledTeachers()
          : [];

      for (const settings of pushTeachers) {
        if (!settings.pushEnabled) {
          continue;
        }

        let teacherToday: string;
        try {
          teacherToday = calculateTeacherToday(now, settings.timeZone).dateString;
        } catch {
          continue;
        }

        const activeSlots = await this.slotRepo.findActiveByAccount(settings.accountId);
        const generatedSessions = generateClassSessions(activeSlots, teacherToday, teacherToday);

        const dbSessions = await this.sessionRepo.findByAccountAndDateRange(
          settings.accountId,
          teacherToday,
          teacherToday,
        );

        const overrides = new Map<string, ClassSession>();
        const activeAdHocs: ClassSession[] = [];

        for (const session of dbSessions) {
          if (session.isOverride()) {
            overrides.set(session.id, session);
          } else if (session.isAdHoc() && !session.isDeleted()) {
            activeAdHocs.push(session);
          }
        }

        // 3A. Process generated sessions from timetable slots
        for (const genSession of generatedSessions) {
          const override = overrides.get(genSession.id);
          if (override && override.cancelled) {
            skippedCount++;
            continue;
          }

          const effectiveStartTime =
            override && override.startTime ? override.startTime : genSession.startTime;
          const effectiveSubject =
            override && override.subject ? override.subject : genSession.subject;
          const effectiveGrade =
            override && override.grade !== undefined && override.grade !== null
              ? override.grade
              : genSession.grade;
          const effectiveRoom =
            override && override.room !== undefined && override.room !== null
              ? override.room
              : genSession.room;

          let remindAt: Date;
          try {
            remindAt = calculateClassSessionRemindAt(
              genSession.date,
              effectiveStartTime,
              settings.timeZone,
              settings.reminderLeadMinutes,
            );
          } catch {
            skippedCount++;
            continue;
          }

          if (remindAt.getTime() > now.getTime() || remindAt.getTime() < tenMinutesAgo.getTime()) {
            skippedCount++;
            continue;
          }

          const alreadySent = await this.sentReminderRepo.exists(
            'class_session',
            genSession.id,
            remindAt,
          );
          if (alreadySent) {
            skippedCount++;
            continue;
          }

          const payload = formatClassSessionReminderNotification(settings.locale, {
            id: genSession.id,
            date: genSession.date,
            startTime: effectiveStartTime,
            subject: effectiveSubject,
            grade: effectiveGrade,
            room: effectiveRoom,
          });

          const pushResult = await this.sendPushUseCase.execute({
            accountId: settings.accountId,
            payload,
          });

          if (pushResult.sent > 0) {
            const sentRecord = SentReminder.create({
              type: 'class_session',
              targetId: genSession.id,
              remindAt,
              accountId: settings.accountId,
              now,
            });

            await this.sentReminderRepo.save(sentRecord);
            sentCount++;
          } else {
            skippedCount++;
          }
        }

        // 3B. Process ad-hoc class sessions
        for (const adHoc of activeAdHocs) {
          if (adHoc.cancelled || !adHoc.startTime) {
            skippedCount++;
            continue;
          }

          let remindAt: Date;
          try {
            remindAt = calculateClassSessionRemindAt(
              adHoc.date,
              adHoc.startTime,
              settings.timeZone,
              settings.reminderLeadMinutes,
            );
          } catch {
            skippedCount++;
            continue;
          }

          if (remindAt.getTime() > now.getTime() || remindAt.getTime() < tenMinutesAgo.getTime()) {
            skippedCount++;
            continue;
          }

          const alreadySent = await this.sentReminderRepo.exists(
            'class_session',
            adHoc.id,
            remindAt,
          );
          if (alreadySent) {
            skippedCount++;
            continue;
          }

          const payload = formatClassSessionReminderNotification(settings.locale, {
            id: adHoc.id,
            date: adHoc.date,
            startTime: adHoc.startTime,
            subject: adHoc.subject ?? '',
            grade: adHoc.grade ?? undefined,
            room: adHoc.room ?? undefined,
          });

          const pushResult = await this.sendPushUseCase.execute({
            accountId: settings.accountId,
            payload,
          });

          if (pushResult.sent > 0) {
            const sentRecord = SentReminder.create({
              type: 'class_session',
              targetId: adHoc.id,
              remindAt,
              accountId: settings.accountId,
              now,
            });

            await this.sentReminderRepo.save(sentRecord);
            sentCount++;
          } else {
            skippedCount++;
          }
        }
      }
    }

    return {
      sent: sentCount,
      skipped: skippedCount,
    };
  }
}
