import { Tone } from '../../domain/timetable/tone.vo';

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
