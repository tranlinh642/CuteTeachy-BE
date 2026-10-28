import { TimetableSlot } from '../../domain/timetable/timetable-slot.entity';
import { Tone } from '../../domain/timetable/tone.vo';
import {
  PayloadConflictError,
  TimetableConflictError,
} from '../../domain/timetable/timetable.errors';
import { findConflictingSlot } from '../../domain/timetable/timetable-conflict';
import { IdConflictError, EntityGoneError } from '../../domain/shared/sync.errors';
import type { Clock } from '../shared/ports/clock.port';
import type { TimetableSlotRepository } from './ports/timetable-slot.repository.port';
import { TimetableSlotDto, toTimetableSlotDto } from './timetable-slot.dto';

export interface CreateTimetableSlotInput {
  id: string;
  accountId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  subject: string;
  grade?: string | null;
  room?: string | null;
  tone: Tone;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface CreateTimetableSlotOutput {
  slot: TimetableSlotDto;
  created: boolean;
}

export class CreateTimetableSlotUseCase {
  constructor(
    private readonly slotRepo: TimetableSlotRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateTimetableSlotInput): Promise<CreateTimetableSlotOutput> {
    const existing = await this.slotRepo.findById(input.id);

    if (existing) {
      if (existing.accountId !== input.accountId) {
        throw new IdConflictError('Resource id belongs to another account');
      }

      if (existing.isDeleted()) {
        throw new EntityGoneError('Resource has been deleted');
      }

      const matches = existing.matchesPayload(input);
      if (!matches) {
        throw new PayloadConflictError('Payload differs from existing resource');
      }

      return {
        slot: toTimetableSlotDto(existing),
        created: false,
      };
    }

    const activeSlots = await this.slotRepo.findActiveByAccount(input.accountId);
    const conflictingSlot = findConflictingSlot(input, activeSlots);
    if (conflictingSlot) {
      throw new TimetableConflictError('Timetable slot conflicts with an existing slot');
    }

    const slot = TimetableSlot.create({
      id: input.id,
      accountId: input.accountId,
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      subject: input.subject,
      grade: input.grade,
      room: input.room,
      tone: input.tone,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      now: this.clock.now(),
    });

    await this.slotRepo.save(slot);

    return {
      slot: toTimetableSlotDto(slot),
      created: true,
    };
  }
}
