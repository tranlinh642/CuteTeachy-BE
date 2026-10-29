import {
  AiAssistantValidationError,
  AiDraftAlreadyAppliedError,
  AiMessageNotFoundError,
} from '../../domain/ai-assistant/ai-assistant.errors';
import {
  AiConflictStrategy,
  AiScheduleDraftItem,
  AiScheduleDraftSummary,
  isAiConflictStrategy,
  validateAiScheduleDraftItem,
} from '../../domain/ai-assistant/ai-schedule-draft.vo';
import { ClassSession } from '../../domain/class-session/class-session.entity';
import { calculateTeacherToday } from '../../domain/settings/teacher-today.helper';
import { Task } from '../../domain/task/task.entity';
import { resolveConflictingSlotForReplacement } from '../../domain/timetable/timetable-slot-modifier';
import { TimetableSlot } from '../../domain/timetable/timetable-slot.entity';
import type { TeacherSettingsReader } from '../settings/ports/teacher-settings.port';
import type { Clock } from '../shared/ports/clock.port';
import type { IdGenerator } from '../shared/ports/id-generator.port';
import type { UnitOfWork } from '../shared/ports/unit-of-work.port';
import { ApplyAiScheduleDraftResult, toAiChatMessageDto } from './ai-assistant.dto';
import type { AiChatMessageRepository } from './ports/ai-chat-message.repository.port';

export interface ApplyAiScheduleDraftInput {
  accountId: string;
  messageId: string;
  conflictStrategy: AiConflictStrategy;
  items?: AiScheduleDraftItem[];
}

export class ApplyAiScheduleDraftUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly chatMessageRepo: AiChatMessageRepository,
    private readonly settingsReader: TeacherSettingsReader,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: ApplyAiScheduleDraftInput): Promise<ApplyAiScheduleDraftResult> {
    if (!isAiConflictStrategy(input.conflictStrategy)) {
      throw new AiAssistantValidationError(
        'conflictStrategy must be replace_conflicts or skip_conflicts',
      );
    }

    const settings = await this.settingsReader.getSettings(input.accountId);
    const timeZone = settings?.timeZone ?? 'Asia/Ho_Chi_Minh';
    const now = this.clock.now();
    const today = calculateTeacherToday(now, timeZone).dateString;

    return this.uow.run(async (repos) => {
      const chatRepo = repos.aiChatMessageRepo ?? this.chatMessageRepo;
      const message = await chatRepo.findById(input.messageId);
      if (!message || message.accountId !== input.accountId) {
        throw new AiMessageNotFoundError();
      }
      if (!message.draft) {
        throw new AiAssistantValidationError('Message does not contain a schedule draft');
      }
      if (message.draft.status === 'applied') {
        throw new AiDraftAlreadyAppliedError();
      }

      const itemsToApply = (input.items ?? message.draft.items).map(
        validateAiScheduleDraftItem,
      );

      let activeSlots = await repos.timetableSlotRepo.findActiveByAccount(input.accountId);
      let createdCount = 0;
      let replacedCount = 0;
      let skippedCount = 0;

      for (const item of itemsToApply) {
        if (item.kind === 'timetable_slot') {
          if (item.weekday === null || item.weekday === undefined) {
            throw new AiAssistantValidationError(
              'weekday is required for timetable_slot draft item',
            );
          }
          if (!item.startTime || !item.endTime) {
            throw new AiAssistantValidationError(
              'startTime and endTime are required for timetable_slot draft item',
            );
          }

          const targetEffectiveFrom = item.effectiveFrom ?? today;
          const targetEffectiveTo = item.effectiveTo ?? null;

          const conflictingSlots = activeSlots.filter(
            (slot) =>
              !slot.isDeleted() &&
              slot.conflictsWith({
                weekday: item.weekday!,
                startTime: item.startTime!,
                endTime: item.endTime!,
                effectiveFrom: targetEffectiveFrom,
                effectiveTo: targetEffectiveTo,
              }),
          );

          if (conflictingSlots.length > 0) {
            if (input.conflictStrategy === 'skip_conflicts') {
              skippedCount++;
              continue;
            }

            // replace_conflicts
            for (const oldSlot of conflictingSlots) {
              resolveConflictingSlotForReplacement(oldSlot, targetEffectiveFrom, now);
              await repos.timetableSlotRepo.save(oldSlot);
              await repos.classSessionRepo.deleteOverridesBySlotFromDate(
                oldSlot.id,
                targetEffectiveFrom,
              );
              replacedCount++;
            }

            activeSlots = activeSlots.filter((s) => !s.isDeleted());
          }

          const newSlot = TimetableSlot.create({
            id: this.idGenerator.next(),
            accountId: input.accountId,
            weekday: item.weekday,
            startTime: item.startTime,
            endTime: item.endTime,
            subject: item.titleOrSubject,
            grade: item.grade ?? null,
            room: item.room ?? null,
            tone: item.tone ?? 'blue',
            category: item.category ?? 'school_teaching',
            effectiveFrom: targetEffectiveFrom,
            effectiveTo: targetEffectiveTo,
            now,
          });

          await repos.timetableSlotRepo.save(newSlot);
          activeSlots.push(newSlot);
          createdCount++;
        } else if (item.kind === 'class_session') {
          if (!item.startTime || !item.endTime) {
            throw new AiAssistantValidationError(
              'startTime and endTime are required for class_session draft item',
            );
          }
          const sessionDate = item.date ?? today;

          const newSession = ClassSession.createAdHoc({
            id: this.idGenerator.next(),
            accountId: input.accountId,
            date: sessionDate,
            startTime: item.startTime,
            endTime: item.endTime,
            subject: item.titleOrSubject,
            grade: item.grade ?? null,
            room: item.room ?? null,
            tone: item.tone ?? 'blue',
            category: item.category ?? 'school_teaching',
            topic: item.notes ?? null,
            now,
          });

          await repos.classSessionRepo.save(newSession);
          createdCount++;
        } else if (item.kind === 'task') {
          const taskDate = item.date ?? today;
          const newTask = Task.create({
            id: this.idGenerator.next(),
            accountId: input.accountId,
            title: item.titleOrSubject,
            notes: item.notes ?? null,
            date: taskDate,
            time: item.startTime ?? null,
            category: item.category === 'self_study' ? 'personal' : 'school',
            priority: 'normal',
            completed: false,
            now,
          });

          await repos.taskRepo.save(newTask);
          createdCount++;
        }
      }

      const summary: AiScheduleDraftSummary = {
        createdCount,
        replacedCount,
        skippedCount,
      };

      message.markDraftApplied({
        appliedAt: now.toISOString(),
        conflictStrategy: input.conflictStrategy,
        summary,
        items: itemsToApply,
      });

      await chatRepo.save(message);

      return {
        message: toAiChatMessageDto(message),
        summary,
      };
    });
  }
}
