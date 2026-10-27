import { Module } from '@nestjs/common';
import * as crypto from 'crypto';
import { SharedModule } from './shared.module';
import { SettingsModule } from './settings.module';
import { PushSubscriptionModule } from './push-subscription.module';
import { TagModule } from './tag.module';
import { TaskModule } from './task.module';
import { TimetableModule } from './timetable.module';
import { ClassSessionModule } from './class-session.module';
import { CLOCK, Clock } from '../application/shared/ports/clock.port';
import { ID_GENERATOR, IdGenerator } from '../application/shared/ports/id-generator.port';
import {
  TEACHER_SETTINGS_READER,
  TeacherSettingsReader,
} from '../application/settings/ports/teacher-settings.port';
import { SendPushToTeacherUseCase } from '../application/push-subscription/send-push-to-teacher.use-case';
import { PurgeSoftDeletedTagsUseCase } from '../application/tag/purge-soft-deleted-tags.use-case';
import { PurgeSoftDeletedTasksUseCase } from '../application/task/purge-soft-deleted-tasks.use-case';
import {
  SENT_REMINDER_REPOSITORY,
  SentReminderRepository,
} from '../application/reminder/ports/sent-reminder.repository.port';
import {
  TASK_REMINDER_READER,
  TaskReminderReader,
} from '../application/reminder/ports/task-reminder.port';
import {
  CRON_SECRET_VERIFIER,
  CronSecretVerifier,
} from '../application/reminder/ports/cron-secret-verifier.port';
import {
  TIMETABLE_SLOT_REPOSITORY,
  TimetableSlotRepository,
} from '../application/timetable/ports/timetable-slot.repository.port';
import {
  CLASS_SESSION_REPOSITORY,
  ClassSessionRepository,
} from '../application/class-session/ports/class-session.repository.port';
import { DispatchRemindersUseCase } from '../application/reminder/dispatch-reminders.use-case';
import { PrismaSentReminderRepository } from '../infrastructure/persistence/prisma/repositories/prisma-sent-reminder.repository';
import { PrismaTaskReminderReader } from '../infrastructure/persistence/prisma/repositories/prisma-task-reminder.repository';
import { DevReminderSchedulerService } from '../infrastructure/scheduler/dev-reminder-scheduler.service';
import { APP_CONFIG, AppConfig } from '../infrastructure/config/app.config';
import { ReminderController } from '../presentation/http/reminder/reminder.controller';
import { CronSecretGuard } from '../presentation/http/reminder/guards/cron-secret.guard';

@Module({
  imports: [
    SharedModule,
    SettingsModule,
    PushSubscriptionModule,
    TagModule,
    TaskModule,
    TimetableModule,
    ClassSessionModule,
  ],
  controllers: [ReminderController],
  providers: [
    {
      provide: SENT_REMINDER_REPOSITORY,
      useClass: PrismaSentReminderRepository,
    },
    {
      provide: TASK_REMINDER_READER,
      useClass: PrismaTaskReminderReader,
    },
    {
      provide: CRON_SECRET_VERIFIER,
      useFactory: (config: AppConfig): CronSecretVerifier => ({
        verify: (secret: string): boolean => {
          if (!secret || typeof secret !== 'string' || !config.CRON_SECRET) {
            return false;
          }
          const secretBuffer = Buffer.from(secret, 'utf8');
          const expectedBuffer = Buffer.from(config.CRON_SECRET, 'utf8');
          if (secretBuffer.length !== expectedBuffer.length) {
            crypto.timingSafeEqual(secretBuffer, secretBuffer);
            return false;
          }
          return crypto.timingSafeEqual(secretBuffer, expectedBuffer);
        },
      }),
      inject: [APP_CONFIG],
    },
    CronSecretGuard,
    DevReminderSchedulerService,
    {
      provide: DispatchRemindersUseCase,
      useFactory: (
        taskReader: TaskReminderReader,
        settingsReader: TeacherSettingsReader,
        sentReminderRepo: SentReminderRepository,
        sendPushUseCase: SendPushToTeacherUseCase,
        clock: Clock,
        idGenerator: IdGenerator,
        slotRepo: TimetableSlotRepository,
        sessionRepo: ClassSessionRepository,
        purgeTagsUseCase: PurgeSoftDeletedTagsUseCase,
        purgeTasksUseCase: PurgeSoftDeletedTasksUseCase,
      ) =>
        new DispatchRemindersUseCase(
          taskReader,
          settingsReader,
          sentReminderRepo,
          sendPushUseCase,
          clock,
          idGenerator,
          slotRepo,
          sessionRepo,
          purgeTagsUseCase,
          purgeTasksUseCase,
        ),
      inject: [
        TASK_REMINDER_READER,
        TEACHER_SETTINGS_READER,
        SENT_REMINDER_REPOSITORY,
        SendPushToTeacherUseCase,
        CLOCK,
        ID_GENERATOR,
        TIMETABLE_SLOT_REPOSITORY,
        CLASS_SESSION_REPOSITORY,
        PurgeSoftDeletedTagsUseCase,
        PurgeSoftDeletedTasksUseCase,
      ],
    },
  ],
  exports: [
    SENT_REMINDER_REPOSITORY,
    TASK_REMINDER_READER,
    CRON_SECRET_VERIFIER,
    DispatchRemindersUseCase,
  ],
})
export class ReminderModule {}
