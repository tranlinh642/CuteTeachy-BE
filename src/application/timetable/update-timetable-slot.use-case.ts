import { Tone } from '../../domain/timetable/tone.vo';
import { EntityNotFoundError } from '../../domain/shared/sync.errors';
import { TimetableConflictError } from '../../domain/timetable/timetable.errors';
import { calculateTeacherToday } from '../../domain/settings/teacher-today.helper';
import { getPreviousDay } from '../../domain/timetable/timetable-date.helper';
import {
  planSlotModification,
} from '../../domain/timetable/timetable-slot-modifier';
import {
  CandidateSlot,
  findConflictingSlot,
} from '../../domain/timetable/timetable-conflict';
import type { Clock } from '../shared/ports/clock.port';
import type { UnitOfWork } from '../shared/ports/unit-of-work.port';
import type { TeacherSettingsReader } from '../settings/ports/teacher-settings.port';
import type { IdGenerator } from '../shared/ports/id-generator.port';
import { toTimetableSlotDto, UpdateTimetableSlotResult } from './timetable-slot.dto';

export interface UpdateTimetableSlotInput {
  id: string;
  accountId: string;
  weekday?: number;
  startTime?: string;
  endTime?: string;
  subject?: string;
  grade?: string | null;
  room?: string | null;
  tone?: Tone;
  effectiveFrom?: string;
  effectiveTo?: string | null;
}

export class UpdateTimetableSlotUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly teacherSettingsReader: TeacherSettingsReader,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateTimetableSlotInput): Promise<UpdateTimetableSlotResult> {
    const settings = await this.teacherSettingsReader.getSettings(input.accountId);
    const timeZone = settings?.timeZone ?? 'Asia/Ho_Chi_Minh';
    const now = this.clock.now();
    const today = calculateTeacherToday(now, timeZone).dateString;
    const yesterday = getPreviousDay(today);

    return this.uow.run(async (repos) => {
      const slot = await repos.timetableSlotRepo.findById(input.id);
      if (!slot || slot.accountId !== input.accountId || slot.isDeleted()) {
        throw new EntityNotFoundError('Timetable slot not found');
      }

      const newSlotId = this.idGenerator.generate();
      const plan = planSlotModification({
        slot,
        today,
        yesterday,
        newSlotId,
        now,
        updates: {
          weekday: input.weekday,
          startTime: input.startTime,
          endTime: input.endTime,
          subject: input.subject,
          grade: input.grade,
          room: input.room,
          tone: input.tone,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
        },
      });

      // Conflict check: ensure modified or split slot does not collide with other slots of the teacher
      const activeSlots = await repos.timetableSlotRepo.findActiveByAccount(input.accountId);
      const otherSlots = activeSlots.filter(
        (s) => s.id !== slot.id && s.id !== plan.current.id,
      );

      const candidate: CandidateSlot = {
        id: plan.current.id,
        weekday: plan.current.weekday,
        startTime: plan.current.startTime,
        endTime: plan.current.endTime,
        effectiveFrom: plan.current.effectiveFrom,
        effectiveTo: plan.current.effectiveTo,
      };

      const conflict = findConflictingSlot(candidate, otherSlots);
      if (conflict) {
        throw new TimetableConflictError('Timetable slot conflicts with an existing slot');
      }

      if (plan.type === 'split') {
        await repos.timetableSlotRepo.save(plan.previous);
        await repos.timetableSlotRepo.save(plan.current);

        if (plan.overridesAction === 'transfer') {
          await repos.classSessionRepo.transferOverrides(
            plan.previous.id,
            plan.current.id,
            today,
            plan.current.effectiveTo,
          );
        } else {
          await repos.classSessionRepo.deleteOverridesBySlotFromDate(plan.previous.id, today);
        }

        return {
          previous: toTimetableSlotDto(plan.previous),
          current: toTimetableSlotDto(plan.current),
        };
      } else {
        await repos.timetableSlotRepo.save(plan.current);

        if (plan.overridesAction === 'discard') {
          await repos.classSessionRepo.deleteOverridesBySlotFromDate(plan.current.id, today);
        }

        return {
          current: toTimetableSlotDto(plan.current),
        };
      }
    });
  }
}
