import { Clock } from '../shared/ports/clock.port';
import { IdGenerator } from '../shared/ports/id-generator.port';
import { TeacherSettingsReader } from '../settings/ports/teacher-settings.port';
import { SentReminderRepository } from './ports/sent-reminder.repository.port';
import { TaskReminderReader } from './ports/task-reminder.port';
import { NoteReminderReader } from './ports/note-reminder.port';
import { InAppNotificationRepository } from '../notification/ports/in-app-notification.repository.port';
import { SendPushToTeacherUseCase } from '../push-subscription/send-push-to-teacher.use-case';
import { PurgeSoftDeletedTagsUseCase } from '../tag/purge-soft-deleted-tags.use-case';
import { PurgeSoftDeletedTasksUseCase } from '../task/purge-soft-deleted-tasks.use-case';
import { TimetableSlotRepository } from '../timetable/ports/timetable-slot.repository.port';
import { ClassSessionRepository } from '../class-session/ports/class-session.repository.port';
import { SentReminder } from '../../domain/reminder/sent-reminder.entity';
import { InAppNotification } from '../../domain/notification/in-app-notification.entity';
import { ReminderType } from '../../domain/reminder/reminder-type.vo';
import {
  calculateClassSessionRemindAt,
  calculateNoteRemindAt,
  calculateTaskRemindAt,
} from '../../domain/reminder/reminder-time.calculator';
import {
  formatClassSessionReminderNotification,
  formatNoteReminderNotification,
  formatTaskReminderNotification,
} from '../../domain/reminder/reminder-template';
import {
  TeacherDateWindow,
  calculateTeacherDateWindow,
} from '../../domain/settings/teacher-today.helper';
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
  pushEnabled: boolean;
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
    private readonly noteReader?: NoteReminderReader,
    private readonly inAppNotificationRepo?: InAppNotificationRepository,
  ) {}

  async execute(): Promise<DispatchRemindersOutput> {
    const now = this.clock.now();
    const tenMinutesAgo = new Date(now.getTime() - TEN_MINUTES_MS);
    const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);

    // 1. Housekeeping: cleanup old sent reminders (> 30 days), old in-app notifications (> 30 days), soft-deleted tags and soft-deleted tasks
    try {
      await this.sentReminderRepo.deletePermanentlyBefore(thirtyDaysAgo);
    } catch {
      // Non-blocking cleanup
    }

    if (this.inAppNotificationRepo) {
      try {
        await this.inAppNotificationRepo.deletePermanentlyBefore(thirtyDaysAgo);
      } catch {
        // Non-blocking cleanup
      }
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

    // 2. Fetch teacher settings to optimize queries and prevent N+1
    const teacherSettingsList = this.settingsReader.findAllTeachers
      ? await this.settingsReader.findAllTeachers()
      : await this.settingsReader.findPushEnabledTeachers();
    const settingsCache = new Map<string, Settings | null>(
      teacherSettingsList.map((s) => [s.accountId, s]),
    );

    const getTeacherSettings = async (accountId: string): Promise<Settings | null> => {
      if (settingsCache.has(accountId)) {
        return settingsCache.get(accountId)!;
      }
      const fetched = await this.settingsReader.getSettings(accountId);
      settingsCache.set(accountId, fetched);
      return fetched;
    };

    const windowCache = new Map<string, TeacherDateWindow>();
    const getTeacherWindow = (timeZone: string): TeacherDateWindow => {
      const cached = windowCache.get(timeZone);
      if (cached) {
        return cached;
      }
      const computed = calculateTeacherDateWindow(now, timeZone);
      windowCache.set(timeZone, computed);
      return computed;
    };

    // Compute global [fromDate, toDate] bounding window across all teacher timezones
    let globalFromDate = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let globalToDate = new Date(now.getTime() + 38 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (const s of teacherSettingsList) {
      try {
        const win = getTeacherWindow(s.timeZone);
        if (win.yesterday < globalFromDate) globalFromDate = win.yesterday;
        if (win.tomorrow > globalToDate) globalToDate = win.tomorrow;
      } catch {
        // Ignore invalid timezone here; handled per teacher below
      }
    }

    // 3A. Process candidate tasks across [yesterday, today, tomorrow]
    const tasks = await this.taskReader.findUpcomingTasks(globalFromDate, globalToDate);

    for (const task of tasks) {
      // Condition: task has time, not completed, not deleted
      if (!task.time || task.completed || task.deletedAt !== null) {
        skippedCount++;
        continue;
      }

      // Teacher settings check
      const settings = await getTeacherSettings(task.accountId);
      if (!settings || (!settings.pushEnabled && !this.inAppNotificationRepo)) {
        skippedCount++;
        continue;
      }

      let teacherWindow: TeacherDateWindow;
      try {
        teacherWindow = getTeacherWindow(settings.timeZone);
      } catch {
        skippedCount++;
        continue;
      }

      if (task.date < teacherWindow.yesterday || task.date > teacherWindow.tomorrow) {
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
        pushEnabled: settings.pushEnabled,
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

    // 3B. Process candidate notes across [yesterday, today, tomorrow] (SPEC-006)
    if (this.noteReader) {
      const notes = await this.noteReader.findUpcomingNotes(globalFromDate, globalToDate);

      for (const note of notes) {
        if (!note.dueDate || note.completed || note.deletedAt !== null) {
          skippedCount++;
          continue;
        }

        const settings = await getTeacherSettings(note.accountId);
        if (!settings || (!settings.pushEnabled && !this.inAppNotificationRepo)) {
          skippedCount++;
          continue;
        }

        let teacherWindow: TeacherDateWindow;
        try {
          teacherWindow = getTeacherWindow(settings.timeZone);
        } catch {
          skippedCount++;
          continue;
        }

        const noteDate = note.dueDate.slice(0, 10);
        if (noteDate < teacherWindow.yesterday || noteDate > teacherWindow.tomorrow) {
          skippedCount++;
          continue;
        }

        let remindAt: Date;
        try {
          remindAt = calculateNoteRemindAt(
            noteDate,
            note.remindTime,
            settings.timeZone,
            settings.reminderLeadMinutes,
          );
        } catch {
          skippedCount++;
          continue;
        }

        const payload = formatNoteReminderNotification(settings.locale, {
          id: note.id,
          title: note.title,
          dueDate: noteDate,
          remindTime: note.remindTime,
        });

        const sent = await this.processReminderCandidate({
          type: 'note',
          targetId: note.id,
          accountId: note.accountId,
          pushEnabled: settings.pushEnabled,
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

    // 4. Candidate Class Sessions across [yesterday, today, tomorrow] (SPEC-004 + SPEC-005 + SPEC-006)
    for (const settings of teacherSettingsList) {
      if (!settings.pushEnabled && !this.inAppNotificationRepo) {
        continue;
      }

      let teacherWindow: TeacherDateWindow;
      try {
        teacherWindow = getTeacherWindow(settings.timeZone);
      } catch {
        continue;
      }

      const activeSlots = await this.slotRepo.findActiveByAccount(settings.accountId);
      const generatedSessions = generateClassSessions(
        activeSlots,
        teacherWindow.yesterday,
        teacherWindow.tomorrow,
      );

      const dbSessions = await this.sessionRepo.findByAccountAndDateRange(
        settings.accountId,
        teacherWindow.yesterday,
        teacherWindow.tomorrow,
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
          pushEnabled: settings.pushEnabled,
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
          pushEnabled: settings.pushEnabled,
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
    const { type, targetId, accountId, pushEnabled, remindAt, payload, now, tenMinutesAgo } =
      params;

    // Check window: remindAt ∈ (now - 10 minutes, now]
    if (remindAt.getTime() > now.getTime() || remindAt.getTime() < tenMinutesAgo.getTime()) {
      return false;
    }

    // Idempotency check: has this reminder already been sent?
    const alreadySent = await this.sentReminderRepo.exists(type, targetId, remindAt);
    if (alreadySent) {
      return false;
    }

    let inAppCreated = false;
    if (this.inAppNotificationRepo) {
      const notification = InAppNotification.create({
        id: this.idGenerator.next(),
        accountId,
        type,
        targetId,
        title: payload.title,
        body: payload.body,
        url: payload.url,
        data: payload.data,
        now,
      });
      await this.inAppNotificationRepo.save(notification);
      inAppCreated = true;
    }

    let pushSent = 0;
    if (pushEnabled) {
      const pushResult = await this.sendPushUseCase.execute({
        accountId,
        payload,
      });
      pushSent = pushResult.sent;
    }

    if (inAppCreated || pushSent > 0) {
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
