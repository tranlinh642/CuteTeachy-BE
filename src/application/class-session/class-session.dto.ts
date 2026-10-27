import { Tone } from '../../domain/timetable/tone.vo';
import { ClassSession } from '../../domain/class-session/class-session.entity';

export interface PrepItemDto {
  id: string;
  label: string;
  done: boolean;
}

export interface ClassSessionDto {
  id: string;
  timetableSlotId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  grade?: string;
  room?: string;
  tone: Tone;
  topic?: string;
  prepItems: PrepItemDto[];
  cancelled: boolean;
  updatedAt: string;
}

export function toClassSessionDto(session: ClassSession): ClassSessionDto {
  const dto: ClassSessionDto = {
    id: session.id,
    timetableSlotId: session.timetableSlotId,
    date: session.date,
    startTime: session.startTime ?? '',
    endTime: session.endTime ?? '',
    subject: session.subject ?? '',
    tone: session.tone ?? 'blue',
    prepItems: session.prepItems.map((item) => ({
      id: item.id,
      label: item.label,
      done: item.done,
    })),
    cancelled: session.cancelled,
    updatedAt: session.updatedAt.toISOString(),
  };

  if (session.grade !== null && session.grade !== undefined) {
    dto.grade = session.grade;
  }
  if (session.room !== null && session.room !== undefined) {
    dto.room = session.room;
  }
  if (session.topic !== null && session.topic !== undefined) {
    dto.topic = session.topic;
  }

  return dto;
}
