import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TASK_CATEGORIES, TaskCategory } from '../../../domain/task/task-category.vo';
import { TASK_PRIORITIES, TaskPriority } from '../../../domain/task/task-priority.vo';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class CreateTaskRequestDto {
  @IsUUID('all', { message: 'id must be a valid UUID' })
  @IsNotEmpty({ message: 'id is required' })
  id!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'title must be a string' })
  @MinLength(1, { message: 'title must be between 1 and 120 characters' })
  @MaxLength(120, { message: 'title must be between 1 and 120 characters' })
  title!: string;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(1000, { message: 'notes cannot exceed 1000 characters' })
  notes?: string;

  @IsString({ message: 'date must be a string' })
  @Matches(DATE_REGEX, { message: 'date must be in YYYY-MM-DD format' })
  date!: string;

  @IsOptional()
  @IsString({ message: 'time must be a string' })
  @Matches(TIME_REGEX, { message: 'time must be in HH:mm format' })
  time?: string;

  @IsIn(TASK_CATEGORIES, {
    message: 'category must be either school or personal',
  })
  category!: TaskCategory;

  @IsOptional()
  @IsIn(TASK_PRIORITIES, {
    message: 'priority must be either normal or high',
  })
  priority?: TaskPriority;

  @IsOptional()
  @IsBoolean({ message: 'completed must be a boolean' })
  completed?: boolean;

  @IsOptional()
  @IsArray({ message: 'tagIds must be an array' })
  @ArrayMaxSize(10, { message: 'tagIds cannot exceed 10 items' })
  @IsUUID('all', { each: true, message: 'each tagId must be a valid UUID' })
  tagIds?: string[];
}

export class UpdateTaskRequestDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'title must be a string' })
  @MinLength(1, { message: 'title must be between 1 and 120 characters' })
  @MaxLength(120, { message: 'title must be between 1 and 120 characters' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(1000, { message: 'notes cannot exceed 1000 characters' })
  notes?: string;

  @IsOptional()
  @IsString({ message: 'date must be a string' })
  @Matches(DATE_REGEX, { message: 'date must be in YYYY-MM-DD format' })
  date?: string;

  @IsOptional()
  @IsString({ message: 'time must be a string' })
  @Matches(TIME_REGEX, { message: 'time must be in HH:mm format' })
  time?: string;

  @IsOptional()
  @IsIn(TASK_CATEGORIES, {
    message: 'category must be either school or personal',
  })
  category?: TaskCategory;

  @IsOptional()
  @IsIn(TASK_PRIORITIES, {
    message: 'priority must be either normal or high',
  })
  priority?: TaskPriority;

  @IsOptional()
  @IsBoolean({ message: 'completed must be a boolean' })
  completed?: boolean;

  @IsOptional()
  @IsArray({ message: 'tagIds must be an array' })
  @ArrayMaxSize(10, { message: 'tagIds cannot exceed 10 items' })
  @IsUUID('all', { each: true, message: 'each tagId must be a valid UUID' })
  tagIds?: string[];
}

export class ListTasksQueryDto {
  @IsString({ message: 'from is required and must be a string' })
  @Matches(DATE_REGEX, { message: 'from must be in YYYY-MM-DD format' })
  from!: string;

  @IsString({ message: 'to is required and must be a string' })
  @Matches(DATE_REGEX, { message: 'to must be in YYYY-MM-DD format' })
  to!: string;

  @IsOptional()
  @IsString({ message: 'updatedSince must be a string' })
  updatedSince?: string;
}
