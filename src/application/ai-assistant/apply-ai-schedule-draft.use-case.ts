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
import { getWeekdayFromIsoDate } from '../../domain/class-session/class-session-generator';
import { calculateTeacherToday } from '../../domain/settings/teacher-today.helper';
import { Task } from '../../domain/task/task.entity';
import { getPreviousDay } from '../../domain/timetable/timetable-date.helper';
import {
  planSlotDeletion,
  planSlotModification,
  resolveConflictingSlotForReplacement,
} from '../../domain/timetable/timetable-slot-modifier';
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
        'conflictStrategy must be replace_conflicts, skip_conflicts, or replace_all_timetable',
      );
    }

    const settings = await this.settingsReader.getSettings(input.accountId);
    const timeZone = settings?.timeZone ?? 'Asia/Ho_Chi_Minh';
    const now = this.clock.now();
    const today = calculateTeacherToday(now, timeZone).dateString;
    const yesterday = getPreviousDay(today);

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
      let updatedCount = 0;
      let deletedCount = 0;
      let cancelledCount = 0;

      // Full timetable replacement mode: end/delete all active slots effective on/after earliest new slot date
      if (input.conflictStrategy === 'replace_all_timetable') {
        const newTimetableItems = itemsToApply.filter(
          (i) => i.kind === 'timetable_slot' && (i.action ?? 'create') === 'create',
        );
        if (newTimetableItems.length > 0) {
          const replaceFrom = newTimetableItems.reduce<string>((minDate, item) => {
            const candidate = item.effectiveFrom ?? today;
            return candidate < minDate ? candidate : minDate;
          }, newTimetableItems[0].effectiveFrom ?? today);

          for (const oldSlot of activeSlots) {
            if (oldSlot.isDeleted()) continue;
            if (oldSlot.effectiveTo !== null && oldSlot.effectiveTo < replaceFrom) continue;

            resolveConflictingSlotForReplacement(oldSlot, replaceFrom, now);
            await repos.timetableSlotRepo.save(oldSlot);
            await repos.classSessionRepo.deleteOverridesBySlotFromDate(oldSlot.id, replaceFrom);
            replacedCount++;
          }
          activeSlots = activeSlots.filter((s) => !s.isDeleted());
        }
      }

      for (const item of itemsToApply) {
        const action = item.action ?? 'create';

        if (item.kind === 'timetable_slot') {
          if (action === 'delete') {
            let targetSlot = item.targetSlotId
              ? activeSlots.find((s) => !s.isDeleted() && s.id === item.targetSlotId)
              : undefined;
            if (!targetSlot && item.weekday && item.startTime && item.endTime) {
              targetSlot = activeSlots.find(
                (s) =>
                  !s.isDeleted() &&
                  s.weekday === item.weekday &&
                  s.startTime === item.startTime &&
                  s.endTime === item.endTime,
              );
            }
            if (!targetSlot) {
              skippedCount++;
              continue;
            }

            const delPlan = planSlotDeletion(targetSlot, today, yesterday, now);
            if (delPlan.type !== 'noop') {
              await repos.timetableSlotRepo.save(delPlan.slot);
              await repos.classSessionRepo.deleteOverridesBySlotFromDate(delPlan.slot.id, today);
              activeSlots = activeSlots.filter((s) => !s.isDeleted());
              deletedCount++;
            } else {
              skippedCount++;
            }
            continue;
          }

          if (action === 'update') {
            let targetSlot = item.targetSlotId
              ? activeSlots.find((s) => !s.isDeleted() && s.id === item.targetSlotId)
              : undefined;
            if (!targetSlot && item.weekday && item.startTime && item.endTime) {
              targetSlot = activeSlots.find(
                (s) =>
                  !s.isDeleted() &&
                  s.weekday === item.weekday &&
                  s.startTime === item.startTime &&
                  s.endTime === item.endTime,
              );
            }
            if (!targetSlot) {
              throw new AiAssistantValidationError(
                'Target timetable slot not found for update action',
              );
            }

            const newSlotId = this.idGenerator.next();
            const modPlan = planSlotModification({
              slot: targetSlot,
              today,
              yesterday,
              newSlotId,
              now,
              updates: {
                weekday: item.weekday ?? undefined,
                startTime: item.startTime ?? undefined,
                endTime: item.endTime ?? undefined,
                subject: item.titleOrSubject,
                grade: item.grade,
                room: item.room,
                tone: item.tone,
                category: item.category,
                effectiveFrom: item.effectiveFrom ?? undefined,
                effectiveTo: item.effectiveTo,
              },
            });

            const conflictingSlots = activeSlots.filter(
              (slot) =>
                !slot.isDeleted() &&
                slot.id !== targetSlot.id &&
                slot.id !== modPlan.current.id &&
                slot.conflictsWith({
                  weekday: modPlan.current.weekday,
                  startTime: modPlan.current.startTime,
                  endTime: modPlan.current.endTime,
                  effectiveFrom: modPlan.current.effectiveFrom,
                  effectiveTo: modPlan.current.effectiveTo,
                }),
            );

            if (conflictingSlots.length > 0) {
              if (input.conflictStrategy === 'skip_conflicts') {
                skippedCount++;
                continue;
              }
              for (const oldSlot of conflictingSlots) {
                resolveConflictingSlotForReplacement(oldSlot, modPlan.current.effectiveFrom, now);
                await repos.timetableSlotRepo.save(oldSlot);
                await repos.classSessionRepo.deleteOverridesBySlotFromDate(
                  oldSlot.id,
                  modPlan.current.effectiveFrom,
                );
                replacedCount++;
              }
              activeSlots = activeSlots.filter((s) => !s.isDeleted());
            }

            if (modPlan.type === 'split') {
              await repos.timetableSlotRepo.save(modPlan.previous);
              await repos.timetableSlotRepo.save(modPlan.current);
              if (modPlan.overridesAction === 'transfer') {
                await repos.classSessionRepo.transferOverrides(
                  modPlan.previous.id,
                  modPlan.current.id,
                  today,
                  modPlan.current.effectiveTo,
                );
              } else {
                await repos.classSessionRepo.deleteOverridesBySlotFromDate(
                  modPlan.previous.id,
                  today,
                );
              }
              activeSlots.push(modPlan.current);
            } else {
              await repos.timetableSlotRepo.save(modPlan.current);
              if (modPlan.overridesAction === 'discard') {
                await repos.classSessionRepo.deleteOverridesBySlotFromDate(
                  modPlan.current.id,
                  today,
                );
              }
            }

            updatedCount++;
            continue;
          }

          // action === 'create'
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

            // replace_conflicts or replace_all_timetable
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
          if (action === 'cancel' || action === 'delete') {
            let resolvedSessionId =
              item.targetSessionId ??
              (item.targetSlotId && item.date ? `${item.targetSlotId}:${item.date}` : null);

            if (!resolvedSessionId && item.date && item.startTime) {
              const targetWeekday = getWeekdayFromIsoDate(item.date);
              const matchedSlot = activeSlots.find(
                (s) =>
                  !s.isDeleted() &&
                  s.weekday === targetWeekday &&
                  s.startTime === item.startTime &&
                  s.effectiveFrom <= item.date! &&
                  (s.effectiveTo === null || item.date! <= s.effectiveTo),
              );
              if (matchedSlot) {
                resolvedSessionId = `${matchedSlot.id}:${item.date}`;
              }
            }

            if (!resolvedSessionId) {
              skippedCount++;
              continue;
            }

            if (resolvedSessionId.includes(':')) {
              const colonIdx = resolvedSessionId.indexOf(':');
              const slotId = resolvedSessionId.substring(0, colonIdx);
              const sessionDate = resolvedSessionId.substring(colonIdx + 1);

              const slot = activeSlots.find((s) => !s.isDeleted() && s.id === slotId);
              if (!slot) {
                skippedCount++;
                continue;
              }

              let override = await repos.classSessionRepo.findById(resolvedSessionId);
              if (!override) {
                override = ClassSession.createOverride({
                  id: resolvedSessionId,
                  accountId: input.accountId,
                  timetableSlotId: slot.id,
                  date: sessionDate,
                  topic: item.notes ?? null,
                  cancelled: true,
                  now,
                });
              } else {
                override.updateOverride({
                  cancelled: true,
                  topic: item.notes !== undefined ? item.notes : undefined,
                  now,
                });
              }
              await repos.classSessionRepo.save(override);
              cancelledCount++;
            } else {
              const existing = await repos.classSessionRepo.findById(resolvedSessionId);
              if (!existing || existing.accountId !== input.accountId || existing.isDeleted()) {
                skippedCount++;
                continue;
              }
              if (action === 'delete') {
                existing.delete(now);
                deletedCount++;
              } else {
                existing.updateAdHoc({ cancelled: true, now });
                cancelledCount++;
              }
              await repos.classSessionRepo.save(existing);
            }
            continue;
          }

          if (action === 'update') {
            const resolvedSessionId =
              item.targetSessionId ??
              (item.targetSlotId && item.date ? `${item.targetSlotId}:${item.date}` : null);

            if (resolvedSessionId && !resolvedSessionId.includes(':')) {
              const existing = await repos.classSessionRepo.findById(resolvedSessionId);
              if (!existing || existing.accountId !== input.accountId || existing.isDeleted()) {
                throw new AiAssistantValidationError(
                  'Target class session not found for update action',
                );
              }
              existing.updateAdHoc({
                date: item.date ?? undefined,
                startTime: item.startTime ?? undefined,
                endTime: item.endTime ?? undefined,
                subject: item.titleOrSubject,
                grade: item.grade,
                room: item.room,
                tone: item.tone,
                category: item.category,
                topic: item.notes,
                now,
              });
              await repos.classSessionRepo.save(existing);
              updatedCount++;
              continue;
            }

            if (resolvedSessionId && resolvedSessionId.includes(':')) {
              if (!item.startTime || !item.endTime) {
                throw new AiAssistantValidationError(
                  'startTime and endTime are required for class_session update item',
                );
              }
              const colonIdx = resolvedSessionId.indexOf(':');
              const slotId = resolvedSessionId.substring(0, colonIdx);
              const originalDate = resolvedSessionId.substring(colonIdx + 1);
              const slot = activeSlots.find((s) => !s.isDeleted() && s.id === slotId);
              if (slot) {
                let override = await repos.classSessionRepo.findById(resolvedSessionId);
                if (!override) {
                  override = ClassSession.createOverride({
                    id: resolvedSessionId,
                    accountId: input.accountId,
                    timetableSlotId: slot.id,
                    date: originalDate,
                    cancelled: true,
                    now,
                  });
                } else {
                  override.updateOverride({ cancelled: true, now });
                }
                await repos.classSessionRepo.save(override);
              }

              const movedSession = ClassSession.createAdHoc({
                id: this.idGenerator.next(),
                accountId: input.accountId,
                date: item.date ?? originalDate,
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
              await repos.classSessionRepo.save(movedSession);
              updatedCount++;
              continue;
            }
          }

          // action === 'create'
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
        ...(updatedCount > 0 ? { updatedCount } : {}),
        ...(deletedCount > 0 ? { deletedCount } : {}),
        ...(cancelledCount > 0 ? { cancelledCount } : {}),
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
