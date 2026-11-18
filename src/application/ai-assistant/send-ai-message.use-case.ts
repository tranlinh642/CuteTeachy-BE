import { AiChatMessage } from '../../domain/ai-assistant/ai-chat-message.entity';
import { AiAssistantValidationError } from '../../domain/ai-assistant/ai-assistant.errors';
import {
  computeContextDateWindow,
  enrichDraftItemsWithConflicts,
} from '../../domain/ai-assistant/ai-draft-enricher';
import {
  AI_IMAGE_RETENTION_MS,
  validateAiChatImage,
} from '../../domain/ai-assistant/ai-image.validator';
import {
  buildCrossAccountRefusalReply,
  detectCrossAccountOrInjectionAttempt,
} from '../../domain/ai-assistant/ai-guardrails';
import { AiScheduleDraft } from '../../domain/ai-assistant/ai-schedule-draft.vo';
import { STANDARD_PERIOD_TIMES } from '../../domain/ai-assistant/standard-period-times';
import {
  getWeekdayFromIsoDate,
  resolveEffectiveClassSessions,
} from '../../domain/class-session/class-session-generator';
import { calculateTeacherToday } from '../../domain/settings/teacher-today.helper';
import type { ObjectStorage } from '../avatar/ports/object-storage.port';
import type { ClassSessionRepository } from '../class-session/ports/class-session.repository.port';
import type { NoteRepository } from '../note/ports/note.repository.port';
import type { TeacherSettingsReader } from '../settings/ports/teacher-settings.port';
import type { Clock } from '../shared/ports/clock.port';
import type { IdGenerator } from '../shared/ports/id-generator.port';
import type { TaskRepository } from '../task/ports/task.repository.port';
import type { TimetableSlotRepository } from '../timetable/ports/timetable-slot.repository.port';
import { SendAiMessageResult, toAiChatMessageDto } from './ai-assistant.dto';
import type { AiAssistantPort } from './ports/ai-assistant.port';
import type { AiChatMessageRepository } from './ports/ai-chat-message.repository.port';

export interface SendAiMessageInput {
  accountId: string;
  message?: string | null;
  image?: {
    buffer: Buffer;
    size: number;
    mimeType?: string;
  } | null;
}

export class SendAiMessageUseCase {
  constructor(
    private readonly aiAssistant: AiAssistantPort,
    private readonly chatMessageRepo: AiChatMessageRepository,
    private readonly timetableSlotRepo: TimetableSlotRepository,
    private readonly classSessionRepo: ClassSessionRepository,
    private readonly taskRepo: TaskRepository,
    private readonly noteRepo: NoteRepository,
    private readonly settingsReader: TeacherSettingsReader,
    private readonly storage: ObjectStorage,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly bucket = 'avatars',
  ) {}

  async execute(input: SendAiMessageInput): Promise<SendAiMessageResult> {
    const trimmedMessage = input.message?.trim() ?? '';
    const hasImage = Boolean(input.image);

    if (!trimmedMessage && !hasImage) {
      throw new AiAssistantValidationError('Either a text message or an image is required');
    }

    const now = this.clock.now();

    if (trimmedMessage && detectCrossAccountOrInjectionAttempt(trimmedMessage)) {
      const settings = await this.settingsReader.getSettings(input.accountId);
      const locale = settings?.locale ?? 'vi';

      const userMessage = AiChatMessage.create({
        id: this.idGenerator.next(),
        accountId: input.accountId,
        role: 'user',
        content: trimmedMessage,
        imageUrl: null,
        imageKey: null,
        imageExpiresAt: null,
        draft: null,
        now,
      });

      const assistantMessage = AiChatMessage.create({
        id: this.idGenerator.next(),
        accountId: input.accountId,
        role: 'assistant',
        content: buildCrossAccountRefusalReply(locale),
        imageUrl: null,
        imageKey: null,
        imageExpiresAt: null,
        draft: null,
        now: new Date(now.getTime() + 1),
      });

      await this.chatMessageRepo.save(userMessage);
      await this.chatMessageRepo.save(assistantMessage);

      return {
        userMessage: toAiChatMessageDto(userMessage),
        assistantMessage: toAiChatMessageDto(assistantMessage),
      };
    }

    let imageUrl: string | null = null;
    let imageKey: string | null = null;
    let imageExpiresAt: Date | null = null;
    let imagePayloadForAi:
      | {
          base64: string;
          mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
        }
      | undefined;

    if (input.image) {
      const validated = validateAiChatImage(
        input.image.buffer,
        input.image.size,
        input.image.mimeType,
      );
      imageKey = `ai-chat/${this.idGenerator.next()}.${validated.extension}`;
      await this.storage.putObject({
        bucket: this.bucket,
        key: imageKey,
        body: input.image.buffer,
        contentType: validated.mimeType,
      });
      imageUrl = this.storage.getPublicUrl(this.bucket, imageKey);
      imageExpiresAt = new Date(now.getTime() + AI_IMAGE_RETENTION_MS);
      imagePayloadForAi = {
        base64: input.image.buffer.toString('base64'),
        mimeType: validated.mimeType,
      };
    }

    try {
      const settings = await this.settingsReader.getSettings(input.accountId);
      const timeZone = settings?.timeZone ?? 'Asia/Ho_Chi_Minh';
      const locale = settings?.locale ?? 'vi';
      const today = calculateTeacherToday(now, timeZone).dateString;
      const weekday = getWeekdayFromIsoDate(today);

      const { windowFrom, windowTo } = computeContextDateWindow(today, trimmedMessage);

      const [activeSlots, dbSessions, tasksRes, notesRes, recentHistory] = await Promise.all([
        this.timetableSlotRepo.findActiveByAccount(input.accountId),
        this.classSessionRepo.findByAccountAndDateRange(input.accountId, windowFrom, windowTo),
        this.taskRepo.findByAccountAndDateRange(input.accountId, windowFrom, windowTo),
        this.noteRepo.findByAccount(input.accountId, { limit: 100 }),
        this.chatMessageRepo.findByAccount(input.accountId, 10),
      ]);

      const classSessionsContext = resolveEffectiveClassSessions(
        activeSlots,
        dbSessions,
        windowFrom,
        windowTo,
      ).map((s) => ({
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        subject: s.subject,
        grade: s.grade ?? null,
        room: s.room ?? null,
        category: s.category,
        topic: s.topic ?? null,
        cancelled: s.cancelled,
        isAdHoc: s.isAdHoc,
      }));

      const aiReply = await this.aiAssistant.generateReply({
        message: trimmedMessage || undefined,
        image: imagePayloadForAi,
        history: recentHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        context: {
          accountId: input.accountId,
          today,
          weekday,
          timeZone,
          locale,
          windowFrom,
          windowTo,
          standardPeriodTimes: STANDARD_PERIOD_TIMES,
          timetableSlots: activeSlots.map((slot) => ({
            id: slot.id,
            weekday: slot.weekday,
            startTime: slot.startTime,
            endTime: slot.endTime,
            subject: slot.subject,
            grade: slot.grade,
            room: slot.room,
            category: slot.category,
            effectiveFrom: slot.effectiveFrom,
            effectiveTo: slot.effectiveTo,
          })),
          classSessions: classSessionsContext,
          tasks: tasksRes.items
            .filter((t) => !t.isDeleted())
            .map((t) => ({
              id: t.id,
              title: t.title,
              date: t.date,
              time: t.time,
              category: t.category,
              priority: t.priority,
              completed: t.completed,
              notes: t.notes,
            })),
          notes: notesRes.items
            .filter((n) => !n.isDeleted())
            .map((n) => ({
              id: n.id,
              title: n.title,
              content: n.content,
              dueDate: n.dueDate,
              remindTime: n.remindTime,
              completed: n.completed,
            })),
        },
      });

      let draft: AiScheduleDraft | null = null;
      if (aiReply.draftItems && aiReply.draftItems.length > 0) {
        const processedItems = enrichDraftItemsWithConflicts(aiReply.draftItems, {
          today,
          activeSlots,
          generateId: () => this.idGenerator.next(),
        });

        draft = {
          status: 'pending',
          appliedAt: null,
          conflictStrategy: null,
          summary: null,
          items: processedItems,
        };
      }

      const userMessage = AiChatMessage.create({
        id: this.idGenerator.next(),
        accountId: input.accountId,
        role: 'user',
        content:
          trimmedMessage ||
          (locale === 'en' ? '[Uploaded timetable image]' : '[Ảnh thời khóa biểu đính kèm]'),
        imageUrl,
        imageKey,
        imageExpiresAt,
        draft: null,
        now,
      });

      const assistantCreatedAt = new Date(now.getTime() + 1);
      const assistantMessage = AiChatMessage.create({
        id: this.idGenerator.next(),
        accountId: input.accountId,
        role: 'assistant',
        content: aiReply.reply,
        imageUrl: null,
        imageKey: null,
        imageExpiresAt: null,
        draft,
        now: assistantCreatedAt,
      });

      await this.chatMessageRepo.save(userMessage);
      await this.chatMessageRepo.save(assistantMessage);

      return {
        userMessage: toAiChatMessageDto(userMessage),
        assistantMessage: toAiChatMessageDto(assistantMessage),
      };
    } catch (err) {
      if (imageKey) {
        try {
          await this.storage.deleteObject(this.bucket, imageKey);
        } catch {
          // Ignore cleanup errors and rethrow original error
        }
      }
      throw err;
    }
  }
}
