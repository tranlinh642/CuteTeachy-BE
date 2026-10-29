import { AiChatMessage } from '../../domain/ai-assistant/ai-chat-message.entity';
import { AiAssistantValidationError } from '../../domain/ai-assistant/ai-assistant.errors';
import {
  AI_IMAGE_RETENTION_MS,
  validateAiChatImage,
} from '../../domain/ai-assistant/ai-image.validator';
import {
  AiScheduleDraft,
  AiScheduleDraftItem,
  validateAiScheduleDraftItem,
} from '../../domain/ai-assistant/ai-schedule-draft.vo';
import { STANDARD_PERIOD_TIMES } from '../../domain/ai-assistant/standard-period-times';
import {
  generateClassSessions,
  getWeekdayFromIsoDate,
} from '../../domain/class-session/class-session-generator';
import { ClassSession } from '../../domain/class-session/class-session.entity';
import { calculateTeacherToday } from '../../domain/settings/teacher-today.helper';
import {
  CandidateSlot,
  findConflictingSlot,
  hasTimetableConflict,
} from '../../domain/timetable/timetable-conflict';
import { addDaysToDateString } from '../../domain/timetable/timetable-date.helper';
import type { ObjectStorage } from '../avatar/ports/object-storage.port';
import type { ClassSessionRepository } from '../class-session/ports/class-session.repository.port';
import type { NoteRepository } from '../note/ports/note.repository.port';
import type { TeacherSettingsReader } from '../settings/ports/teacher-settings.port';
import type { Clock } from '../shared/ports/clock.port';
import type { IdGenerator } from '../shared/ports/id-generator.port';
import type { TaskRepository } from '../task/ports/task.repository.port';
import type { TimetableSlotRepository } from '../timetable/ports/timetable-slot.repository.port';
import { SendAiMessageResult, toAiChatMessageDto } from './ai-assistant.dto';
import type {
  AiAssistantClassSessionContext,
  AiAssistantPort,
} from './ports/ai-assistant.port';
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

    const settings = await this.settingsReader.getSettings(input.accountId);
    const timeZone = settings?.timeZone ?? 'Asia/Ho_Chi_Minh';
    const locale = settings?.locale ?? 'vi';
    const today = calculateTeacherToday(now, timeZone).dateString;
    const weekday = getWeekdayFromIsoDate(today);

    const { windowFrom, windowTo } = this.computeContextDateWindow(today, trimmedMessage);

    const [activeSlots, dbSessions, tasksRes, notesRes, recentHistory] = await Promise.all([
      this.timetableSlotRepo.findActiveByAccount(input.accountId),
      this.classSessionRepo.findByAccountAndDateRange(input.accountId, windowFrom, windowTo),
      this.taskRepo.findByAccountAndDateRange(input.accountId, windowFrom, windowTo),
      this.noteRepo.findByAccount(input.accountId, { limit: 100 }),
      this.chatMessageRepo.findByAccount(input.accountId, 10),
    ]);

    const classSessionsContext = this.buildClassSessionsContext(
      activeSlots,
      dbSessions,
      windowFrom,
      windowTo,
    );

    const aiReply = await this.aiAssistant.generateReply({
      message: trimmedMessage || undefined,
      image: imagePayloadForAi,
      history: recentHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      context: {
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
      const processedItems: AiScheduleDraftItem[] = aiReply.draftItems.map((rawItem) => {
        const normalized = validateAiScheduleDraftItem({
          ...rawItem,
          id: rawItem.id || this.idGenerator.next(),
          category: rawItem.category ?? 'school_teaching',
          tone: rawItem.tone ?? 'blue',
          effectiveFrom:
            rawItem.kind === 'timetable_slot'
              ? (rawItem.effectiveFrom ?? today)
              : (rawItem.effectiveFrom ?? null),
          date:
            rawItem.kind === 'class_session' || rawItem.kind === 'task'
              ? (rawItem.date ?? today)
              : (rawItem.date ?? null),
        });

        if (
          normalized.kind === 'timetable_slot' &&
          normalized.weekday &&
          normalized.startTime &&
          normalized.endTime
        ) {
          const candidate: CandidateSlot = {
            weekday: normalized.weekday,
            startTime: normalized.startTime,
            endTime: normalized.endTime,
            effectiveFrom: normalized.effectiveFrom ?? today,
            effectiveTo: normalized.effectiveTo ?? null,
          };
          if (hasTimetableConflict(candidate, activeSlots)) {
            const conflictingSlot = findConflictingSlot(candidate, activeSlots)!;
            normalized.conflict = {
              slotId: conflictingSlot.id,
              subject: conflictingSlot.subject,
              startTime: conflictingSlot.startTime,
              endTime: conflictingSlot.endTime,
            };
          } else {
            normalized.conflict = null;
          }
        } else {
          normalized.conflict = null;
        }

        return normalized;
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
  }

  private computeContextDateWindow(
    today: string,
    message: string,
  ): { windowFrom: string; windowTo: string } {
    let windowFrom = addDaysToDateString(today, -7);
    let windowTo = addDaysToDateString(today, 14);

    // Check if message mentions explicit YYYY-MM-DD or DD/MM/YYYY dates
    const isoMatches = message.match(/\b(\d{4}-\d{2}-\d{2})\b/g) ?? [];
    const dmyMatches = message.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g) ?? [];

    const candidateDates: string[] = [...isoMatches];
    for (const dmy of dmyMatches) {
      const [d, m, y] = dmy.split('/');
      candidateDates.push(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    }

    const minAllowed = addDaysToDateString(today, -60);
    const maxAllowed = addDaysToDateString(today, 60);

    for (const dt of candidateDates) {
      if (dt >= minAllowed && dt < windowFrom) {
        windowFrom = dt;
      }
      if (dt <= maxAllowed && dt > windowTo) {
        windowTo = dt;
      }
    }

    return { windowFrom, windowTo };
  }

  private buildClassSessionsContext(
    activeSlots: Awaited<ReturnType<TimetableSlotRepository['findActiveByAccount']>>,
    dbSessions: ClassSession[],
    from: string,
    to: string,
  ): AiAssistantClassSessionContext[] {
    const generatedSessions = generateClassSessions(activeSlots, from, to);
    const overrides = new Map<string, ClassSession>();
    const activeAdHocs: ClassSession[] = [];

    for (const session of dbSessions) {
      if (session.isOverride()) {
        overrides.set(session.id, session);
      } else if (session.isAdHoc() && !session.isDeleted()) {
        activeAdHocs.push(session);
      }
    }

    const result: AiAssistantClassSessionContext[] = generatedSessions.map((gen) => {
      const override = overrides.get(gen.id);
      return {
        id: gen.id,
        date: gen.date,
        startTime: gen.startTime,
        endTime: gen.endTime,
        subject: gen.subject,
        grade: gen.grade ?? null,
        room: gen.room ?? null,
        category: override?.category ?? gen.category,
        topic: override?.topic ?? null,
        cancelled: override?.cancelled ?? gen.cancelled,
        isAdHoc: false,
      };
    });

    for (const adHoc of activeAdHocs) {
      if (adHoc.startTime && adHoc.endTime && adHoc.subject) {
        result.push({
          id: adHoc.id,
          date: adHoc.date,
          startTime: adHoc.startTime,
          endTime: adHoc.endTime,
          subject: adHoc.subject,
          grade: adHoc.grade,
          room: adHoc.room,
          category: adHoc.category ?? 'school_teaching',
          topic: adHoc.topic,
          cancelled: adHoc.cancelled,
          isAdHoc: true,
        });
      }
    }

    result.sort((a, b) => {
      const dCmp = a.date.localeCompare(b.date);
      if (dCmp !== 0) return dCmp;
      return a.startTime.localeCompare(b.startTime);
    });

    return result;
  }
}
