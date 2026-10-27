import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TONES, Tone } from '../../../domain/timetable/tone.vo';

export class PrepItemRequestDto {
  @IsString({ message: 'id must be a string' })
  @IsNotEmpty({ message: 'id is required' })
  id!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'label must be a string' })
  @MinLength(1, { message: 'label cannot be empty' })
  label!: string;

  @IsBoolean({ message: 'done must be a boolean' })
  done!: boolean;
}

export class CreateAdHocClassSessionRequestDto {
  @IsUUID('all', { message: 'id must be a valid UUID' })
  @IsNotEmpty({ message: 'id is required' })
  id!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be in HH:mm format' })
  startTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be in HH:mm format' })
  endTime!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'subject must be at least 1 character' })
  @MaxLength(120, { message: 'subject cannot exceed 120 characters' })
  subject!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  grade?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  room?: string;

  @IsIn(TONES, {
    message: 'tone must be one of pink, blue, beige, lavender, rose, mint',
  })
  tone!: Tone;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'topic cannot exceed 500 characters' })
  topic?: string;

  @IsOptional()
  @IsArray({ message: 'prepItems must be an array' })
  @ArrayMaxSize(100, { message: 'prepItems cannot exceed 100 items' })
  @ValidateNested({ each: true })
  @Type(() => PrepItemRequestDto)
  prepItems?: PrepItemRequestDto[];

  @IsOptional()
  @IsBoolean({ message: 'cancelled must be a boolean' })
  cancelled?: boolean;
}

export class UpdateClassSessionRequestDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be in HH:mm format' })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be in HH:mm format' })
  endTime?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'subject must be at least 1 character' })
  @MaxLength(120, { message: 'subject cannot exceed 120 characters' })
  subject?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  grade?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  room?: string;

  @IsOptional()
  @IsIn(TONES, {
    message: 'tone must be one of pink, blue, beige, lavender, rose, mint',
  })
  tone?: Tone;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'topic cannot exceed 500 characters' })
  topic?: string;

  @IsOptional()
  @IsArray({ message: 'prepItems must be an array' })
  @ArrayMaxSize(100, { message: 'prepItems cannot exceed 100 items' })
  @ValidateNested({ each: true })
  @Type(() => PrepItemRequestDto)
  prepItems?: PrepItemRequestDto[];

  @IsOptional()
  @IsBoolean({ message: 'cancelled must be a boolean' })
  cancelled?: boolean;
}

export class ListClassSessionsQueryDto {
  @IsNotEmpty({ message: 'from is required' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be in YYYY-MM-DD format' })
  from!: string;

  @IsNotEmpty({ message: 'to is required' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be in YYYY-MM-DD format' })
  to!: string;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'updatedSince must be a valid ISO-8601 string' })
  updatedSince?: string;
}
