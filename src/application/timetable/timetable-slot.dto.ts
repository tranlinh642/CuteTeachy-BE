import { TimetableSlot } from '../../domain/timetable/timetable-slot.entity';
import { Tone } from '../../domain/timetable/tone.vo';

export interface TimetableSlotDto {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  subject: string;
  grade?: string;
  room?: string;
  tone: Tone;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
}

export function toTimetableSlotDto(slot: TimetableSlot): TimetableSlotDto {
  const dto: TimetableSlotDto = {
    id: slot.id,
    weekday: slot.weekday,
    startTime: slot.startTime,
    endTime: slot.endTime,
    subject: slot.subject,
    tone: slot.tone,
    effectiveFrom: slot.effectiveFrom,
    createdAt: slot.createdAt.toISOString(),
    updatedAt: slot.updatedAt.toISOString(),
  };

  if (slot.grade !== null) {
    dto.grade = slot.grade;
  }

  if (slot.room !== null) {
    dto.room = slot.room;
  }

  if (slot.effectiveTo !== null) {
    dto.effectiveTo = slot.effectiveTo;
  }

  return dto;
}

export interface UpdateTimetableSlotResult {
  previous?: TimetableSlotDto;
  current: TimetableSlotDto;
}
