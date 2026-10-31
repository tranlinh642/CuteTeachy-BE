import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AI_CONFLICT_STRATEGIES,
  AI_DRAFT_ITEM_KINDS,
  AiConflictStrategy,
  AiDraftItemKind,
} from '../../../domain/ai-assistant/ai-schedule-draft.vo';
import {
  SCHEDULE_CATEGORIES,
  ScheduleCategory,
} from '../../../domain/timetable/schedule-category.vo';
import { TONES, Tone } from '../../../domain/timetable/tone.vo';

export class ListAiChatMessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class SendAiMessageRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;
}

export class AiScheduleDraftConflictDto {
  @IsString()
  slotId!: string;

  @IsString()
  subject!: string;

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;
}

export class AiScheduleDraftItemRequestDto {
  @IsString()
  id!: string;

  @IsIn(AI_DRAFT_ITEM_KINDS)
  kind!: AiDraftItemKind;

  @IsIn(SCHEDULE_CATEGORIES)
  category!: ScheduleCategory;

  @IsString()
  titleOrSubject!: string;

  @IsOptional()
  @IsString()
  grade?: string | null;

  @IsOptional()
  @IsString()
  room?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  weekday?: number | null;

  @IsOptional()
  @IsString()
  date?: string | null;

  @IsOptional()
  @IsString()
  startTime?: string | null;

  @IsOptional()
  @IsString()
  endTime?: string | null;

  @IsOptional()
  @IsString()
  effectiveFrom?: string | null;

  @IsOptional()
  @IsString()
  effectiveTo?: string | null;

  @IsOptional()
  @IsIn(TONES)
  tone?: Tone;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiScheduleDraftConflictDto)
  conflict?: AiScheduleDraftConflictDto | null;
}

export class ApplyAiScheduleDraftRequestDto {
  @IsIn(AI_CONFLICT_STRATEGIES, {
    message: 'conflictStrategy must be replace_conflicts or skip_conflicts',
  })
  conflictStrategy!: AiConflictStrategy;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiScheduleDraftItemRequestDto)
  items?: AiScheduleDraftItemRequestDto[];
}
