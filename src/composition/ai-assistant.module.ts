import { Module } from '@nestjs/common';
import { ApplyAiScheduleDraftUseCase } from '../application/ai-assistant/apply-ai-schedule-draft.use-case';
import { ClearAiChatHistoryUseCase } from '../application/ai-assistant/clear-ai-chat-history.use-case';
import { ListAiChatMessagesUseCase } from '../application/ai-assistant/list-ai-chat-messages.use-case';
import {
  AI_ASSISTANT_PORT,
  AiAssistantPort,
} from '../application/ai-assistant/ports/ai-assistant.port';
import {
  AI_CHAT_MESSAGE_REPOSITORY,
  AiChatMessageRepository,
} from '../application/ai-assistant/ports/ai-chat-message.repository.port';
import { PurgeExpiredAiImagesUseCase } from '../application/ai-assistant/purge-expired-ai-images.use-case';
import { SendAiMessageUseCase } from '../application/ai-assistant/send-ai-message.use-case';
import {
  OBJECT_STORAGE,
  ObjectStorage,
} from '../application/avatar/ports/object-storage.port';
import {
  CLASS_SESSION_REPOSITORY,
  ClassSessionRepository,
} from '../application/class-session/ports/class-session.repository.port';
import {
  NOTE_REPOSITORY,
  NoteRepository,
} from '../application/note/ports/note.repository.port';
import {
  TEACHER_SETTINGS_READER,
  TeacherSettingsReader,
} from '../application/settings/ports/teacher-settings.port';
import { CLOCK, Clock } from '../application/shared/ports/clock.port';
import { ID_GENERATOR, IdGenerator } from '../application/shared/ports/id-generator.port';
import { UNIT_OF_WORK, UnitOfWork } from '../application/shared/ports/unit-of-work.port';
import {
  TASK_REPOSITORY,
  TaskRepository,
} from '../application/task/ports/task.repository.port';
import {
  TIMETABLE_SLOT_REPOSITORY,
  TimetableSlotRepository,
} from '../application/timetable/ports/timetable-slot.repository.port';
import { GeminiAiAssistantAdapter } from '../infrastructure/ai/gemini-ai-assistant.adapter';
import { APP_CONFIG, AppConfig } from '../infrastructure/config/app.config';
import { PrismaAiChatMessageRepository } from '../infrastructure/persistence/prisma/repositories/prisma-ai-chat-message.repository';
import { AiAssistantController } from '../presentation/http/ai-assistant/ai-assistant.controller';
import { AvatarModule } from './avatar.module';
import { ClassSessionModule } from './class-session.module';
import { NoteModule } from './note.module';
import { SettingsModule } from './settings.module';
import { TaskModule } from './task.module';
import { TimetableModule } from './timetable.module';

@Module({
  imports: [
    AvatarModule,
    TimetableModule,
    ClassSessionModule,
    TaskModule,
    NoteModule,
    SettingsModule,
  ],
  controllers: [AiAssistantController],
  providers: [
    {
      provide: AI_ASSISTANT_PORT,
      useClass: GeminiAiAssistantAdapter,
    },
    {
      provide: AI_CHAT_MESSAGE_REPOSITORY,
      useClass: PrismaAiChatMessageRepository,
    },
    {
      provide: SendAiMessageUseCase,
      useFactory: (
        aiAssistant: AiAssistantPort,
        chatMessageRepo: AiChatMessageRepository,
        timetableSlotRepo: TimetableSlotRepository,
        classSessionRepo: ClassSessionRepository,
        taskRepo: TaskRepository,
        noteRepo: NoteRepository,
        settingsReader: TeacherSettingsReader,
        storage: ObjectStorage,
        idGenerator: IdGenerator,
        clock: Clock,
        config: AppConfig,
      ) =>
        new SendAiMessageUseCase(
          aiAssistant,
          chatMessageRepo,
          timetableSlotRepo,
          classSessionRepo,
          taskRepo,
          noteRepo,
          settingsReader,
          storage,
          idGenerator,
          clock,
          config.S3_BUCKET || config.S3_BUCKET_AVATARS || 'avatars',
        ),
      inject: [
        AI_ASSISTANT_PORT,
        AI_CHAT_MESSAGE_REPOSITORY,
        TIMETABLE_SLOT_REPOSITORY,
        CLASS_SESSION_REPOSITORY,
        TASK_REPOSITORY,
        NOTE_REPOSITORY,
        TEACHER_SETTINGS_READER,
        OBJECT_STORAGE,
        ID_GENERATOR,
        CLOCK,
        APP_CONFIG,
      ],
    },
    {
      provide: ApplyAiScheduleDraftUseCase,
      useFactory: (
        uow: UnitOfWork,
        chatMessageRepo: AiChatMessageRepository,
        settingsReader: TeacherSettingsReader,
        idGenerator: IdGenerator,
        clock: Clock,
      ) =>
        new ApplyAiScheduleDraftUseCase(
          uow,
          chatMessageRepo,
          settingsReader,
          idGenerator,
          clock,
        ),
      inject: [
        UNIT_OF_WORK,
        AI_CHAT_MESSAGE_REPOSITORY,
        TEACHER_SETTINGS_READER,
        ID_GENERATOR,
        CLOCK,
      ],
    },
    {
      provide: ListAiChatMessagesUseCase,
      useFactory: (chatMessageRepo: AiChatMessageRepository) =>
        new ListAiChatMessagesUseCase(chatMessageRepo),
      inject: [AI_CHAT_MESSAGE_REPOSITORY],
    },
    {
      provide: ClearAiChatHistoryUseCase,
      useFactory: (
        chatMessageRepo: AiChatMessageRepository,
        storage: ObjectStorage,
        config: AppConfig,
      ) =>
        new ClearAiChatHistoryUseCase(
          chatMessageRepo,
          storage,
          config.S3_BUCKET || config.S3_BUCKET_AVATARS || 'avatars',
        ),
      inject: [AI_CHAT_MESSAGE_REPOSITORY, OBJECT_STORAGE, APP_CONFIG],
    },
    {
      provide: PurgeExpiredAiImagesUseCase,
      useFactory: (
        chatMessageRepo: AiChatMessageRepository,
        storage: ObjectStorage,
        clock: Clock,
        config: AppConfig,
      ) =>
        new PurgeExpiredAiImagesUseCase(
          chatMessageRepo,
          storage,
          clock,
          config.S3_BUCKET || config.S3_BUCKET_AVATARS || 'avatars',
        ),
      inject: [AI_CHAT_MESSAGE_REPOSITORY, OBJECT_STORAGE, CLOCK, APP_CONFIG],
    },
  ],
  exports: [
    AI_ASSISTANT_PORT,
    AI_CHAT_MESSAGE_REPOSITORY,
    SendAiMessageUseCase,
    ApplyAiScheduleDraftUseCase,
    ListAiChatMessagesUseCase,
    ClearAiChatHistoryUseCase,
    PurgeExpiredAiImagesUseCase,
  ],
})
export class AiAssistantModule {}
