import { Clock } from '../shared/ports/clock.port';
import { IdGenerator } from '../shared/ports/id-generator.port';
import { TeacherSettingsReader } from '../settings/ports/teacher-settings.port';
import { SentReminderRepository } from './ports/sent-reminder.repository.port';
import { TaskReminderReader } from './ports/task-reminder.port';
import { SendPushToTeacherUseCase } from '../push-subscription/send-push-to-teacher.use-case';
import { PurgeSoftDeletedTagsUseCase } from '../tag/purge-soft-deleted-tags.use-case';
import { PurgeSoftDeletedTasksUseCase } from '../task/purge-soft-deleted-tasks.use-case';
import { TimetableSlotRepository } from '../timetable/ports/timetable-slot.repository.port';
import { ClassSessionRepository } from '../class-session/ports/class-session.repository.port';
import { SentReminder } from '../../domain/reminder/sent-reminder.entity';
import { ReminderType } from '../../domain/reminder/reminder-type.vo';
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
import { Settings } from '../../domain/settings/settings.entity';
import { DispatchRemindersOutput } from './reminder.dto';

const TEN_MINUTES_MS = 10 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface ProcessReminderParams {
  type: ReminderType;
  targetId: string;
  accountId: string;
  remindAt: Date;
  payload: {
    title: string;
    body: string;
    url: string;
    data: {
      type: ReminderType;
      id: string;
      date: string;
      url: string;
      [key: string]: unknown;
    };
  };
  now: Date;
  tenMinutesAgo: Date;
}

export class DispatchRemindersUseCase {
  constructor(
    private readonly taskReader: TaskReminderReader,
    private readonly settingsReader: TeacherSettingsReader,
    private readonly sentReminderRepo: SentReminderRepository,
    private readonly sendPushUseCase: SendPushToTeacherUseCase,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly slotRepo: TimetableSlotRepository,
    private readonly sessionRepo: ClassSessionRepository,
    private readonly purgeSoftDeletedTagsUseCase?: PurgeSoftDeletedTagsUseCase,
    private readonly purgeSoftDeletedTasksUseCase?: PurgeSoftDeletedTasksUseCase,
  ) {}

  async execute(): Promise<DispatchRemindersOutput> {
    const now = this.clock.now();
    const tenMinutesAgo = new Date(now.getTime() - TEN_MINUTES_MS);

    // 1. Housekeeping: cleanup old sent reminders (> 30 days), soft-deleted tags and soft-deleted tasks
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

    if (this.purgeSoftDeletedTasksUseCase) {
      try {
        await this.purgeSoftDeletedTasksUseCase.execute();
      } catch {
        // Non-blocking cleanup
      }
    }

    let sentCount = 0;
    let skippedCount = 0;

    // 2. Fetch push-enabled teachers to optimize settings queries and prevent N+1
    const pushTeachers = await this.settingsReader.findPushEnabledTeachers();
    const settingsCache = new Map<string, Settings | null>(
      pushTeachers.map((s) => [s.accountId, s]),
    );

    const getTeacherSettings = async (accountId: string): Promise<Settings | null> => {
      if (settingsCache.has(accountId)) {
        return settingsCache.get(accountId)!;
      }
      const fetched = await this.settingsReader.getSettings(accountId);
      settingsCache.set(accountId, fetched);
      return fetched;
    };

    // 3. Process candidate tasks
    const tasks = await this.taskReader.findUpcomingTasks();

    for (const task of tasks) {
      // Condition: task has time, not completed, not deleted
      if (!task.time || task.completed || task.deletedAt !== null) {
        skippedCount++;
        continue;
      }

      // Teacher settings check
      const settings = await getTeacherSettings(task.accountId);
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

      const payload = formatTaskReminderNotification(settings.locale, {
        id: task.id,
        title: task.title,
        time: task.time,
        date: task.date,
      });

      const sent = await this.processReminderCandidate({
        type: 'task',
        targetId: task.id,
        accountId: task.accountId,
        remindAt,
        payload,
        now,
        tenMinutesAgo,
      });

      if (sent) {
        sentCount++;
      } else {
        skippedCount++;
      }
    }

    // 4. Candidate Class Sessions (SPEC-004 + SPEC-005)
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

      // 4A. Process generated sessions from timetable slots
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

        const payload = formatClassSessionReminderNotification(settings.locale, {
          id: genSession.id,
          date: genSession.date,
          startTime: effectiveStartTime,
          subject: effectiveSubject,
          grade: effectiveGrade,
          room: effectiveRoom,
        });

        const sent = await this.processReminderCandidate({
          type: 'class_session',
          targetId: genSession.id,
          accountId: settings.accountId,
          remindAt,
          payload,
          now,
          tenMinutesAgo,
        });

        if (sent) {
          sentCount++;
        } else {
          skippedCount++;
        }
      }

      // 4B. Process ad-hoc class sessions
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

        const payload = formatClassSessionReminderNotification(settings.locale, {
          id: adHoc.id,
          date: adHoc.date,
          startTime: adHoc.startTime,
          subject: adHoc.subject ?? '',
          grade: adHoc.grade ?? undefined,
          room: adHoc.room ?? undefined,
        });

        const sent = await this.processReminderCandidate({
          type: 'class_session',
          targetId: adHoc.id,
          accountId: settings.accountId,
          remindAt,
          payload,
          now,
          tenMinutesAgo,
        });

        if (sent) {
          sentCount++;
        } else {
          skippedCount++;
        }
      }
    }

    return {
      sent: sentCount,
      skipped: skippedCount,
    };
  }

  private async processReminderCandidate(params: ProcessReminderParams): Promise<boolean> {
    const { type, targetId, accountId, remindAt, payload, now, tenMinutesAgo } = params;

    // Check window: remindAt ∈ (now - 10 minutes, now]
    if (remindAt.getTime() > now.getTime() || remindAt.getTime() < tenMinutesAgo.getTime()) {
      return false;
    }

    // Idempotency check: has this reminder already been sent?
    const alreadySent = await this.sentReminderRepo.exists(type, targetId, remindAt);
    if (alreadySent) {
      return false;
    }

    // Send push notification to teacher's devices
    const pushResult = await this.sendPushUseCase.execute({
      accountId,
      payload,
    });

    if (pushResult.sent > 0) {
      const sentRecord = SentReminder.create({
        id: this.idGenerator.next(),
        type,
        targetId,
        remindAt,
        accountId,
        now,
      });

      await this.sentReminderRepo.save(sentRecord);
      return true;
    }

    return false;
  }
}
