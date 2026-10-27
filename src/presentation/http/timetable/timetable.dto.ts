import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TONES, Tone } from '../../../domain/timetable/tone.vo';

export class CreateTimetableSlotRequestDto {
  @IsUUID('4', { message: 'id must be a valid UUID v4' })
  id!: string;

  @IsInt({ message: 'weekday must be an integer' })
  @Min(1, { message: 'weekday must be at least 1 (Monday)' })
  @Max(7, { message: 'weekday must be at most 7 (Sunday)' })
  weekday!: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be in HH:mm format' })
  startTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be in HH:mm format' })
  endTime!: string;

  @IsString()
  @MinLength(1, { message: 'subject must be at least 1 character' })
  @MaxLength(120, { message: 'subject cannot exceed 120 characters' })
  subject!: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  room?: string;

  @IsIn(TONES, {
    message: 'tone must be one of pink, blue, beige, lavender, rose, mint',
  })
  tone!: Tone;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'effectiveFrom must be in YYYY-MM-DD format' })
  effectiveFrom!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'effectiveTo must be in YYYY-MM-DD format' })
  effectiveTo?: string;
}

export class ListTimetableSlotsQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'updatedSince must be a valid ISO-8601 string' })
  updatedSince?: string;
}
