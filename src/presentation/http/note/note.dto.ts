import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

@ValidatorConstraint({ name: 'isValidDueDate', async: false })
export class IsValidDueDate implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null || value === '') {
      return true;
    }
    if (typeof value !== 'string') {
      return false;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      return (
        date.getUTCFullYear() === y &&
        date.getUTCMonth() === m - 1 &&
        date.getUTCDate() === d
      );
    }
    const parsed = new Date(value);
    return !isNaN(parsed.getTime());
  }

  defaultMessage(): string {
    return 'dueDate must be a valid date in YYYY-MM-DD or ISO-8601 format';
  }
}

export class ChecklistItemRequestDto {
  @IsUUID('all', { message: 'id must be a valid UUID' })
  @IsNotEmpty({ message: 'id is required' })
  id!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'text must be a string' })
  @MinLength(1, { message: 'text cannot be empty' })
  text!: string;

  @IsBoolean({ message: 'done must be a boolean' })
  done!: boolean;
}

export class CreateNoteRequestDto {
  @IsUUID('all', { message: 'id must be a valid UUID' })
  @IsNotEmpty({ message: 'id is required' })
  id!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'title must be a string' })
  @MinLength(1, { message: 'title must be between 1 and 120 characters' })
  @MaxLength(120, { message: 'title must be between 1 and 120 characters' })
  title!: string;

  @IsOptional()
  @IsString({ message: 'content must be a string' })
  @MaxLength(5000, { message: 'content cannot exceed 5000 characters' })
  content?: string;

  @IsOptional()
  @IsArray({ message: 'checklist must be an array' })
  @ArrayMaxSize(100, { message: 'checklist cannot exceed 100 items' })
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemRequestDto)
  checklist?: ChecklistItemRequestDto[];

  @IsOptional()
  @IsString({ message: 'imageUrl must be a string' })
  imageUrl?: string;

  @IsOptional()
  @IsArray({ message: 'tagIds must be an array' })
  @ArrayMaxSize(10, { message: 'tagIds cannot exceed 10 items' })
  @IsUUID('all', { each: true, message: 'each tagId must be a valid UUID' })
  tagIds?: string[];

  @IsOptional()
  @Validate(IsValidDueDate)
  dueDate?: string;

  @IsOptional()
  @IsBoolean({ message: 'completed must be a boolean' })
  completed?: boolean;
}

export class UpdateNoteRequestDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'title must be a string' })
  @MinLength(1, { message: 'title must be between 1 and 120 characters' })
  @MaxLength(120, { message: 'title must be between 1 and 120 characters' })
  title?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString({ message: 'content must be a string' })
  @MaxLength(5000, { message: 'content cannot exceed 5000 characters' })
  content?: string | null;

  @IsOptional()
  @IsArray({ message: 'checklist must be an array' })
  @ArrayMaxSize(100, { message: 'checklist cannot exceed 100 items' })
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemRequestDto)
  checklist?: ChecklistItemRequestDto[];

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString({ message: 'imageUrl must be a string' })
  imageUrl?: string | null;

  @IsOptional()
  @IsArray({ message: 'tagIds must be an array' })
  @ArrayMaxSize(10, { message: 'tagIds cannot exceed 10 items' })
  @IsUUID('all', { each: true, message: 'each tagId must be a valid UUID' })
  tagIds?: string[];

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Validate(IsValidDueDate)
  dueDate?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'completed must be a boolean' })
  completed?: boolean;
}

export class ListNotesQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : undefined))
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(50, { message: 'limit cannot exceed 50' })
  limit?: number;

  @IsOptional()
  @IsString({ message: 'cursor must be a string' })
  cursor?: string;

  @IsOptional()
  @IsString({ message: 'q must be a string' })
  q?: string;

  @IsOptional()
  @IsUUID('all', { message: 'tagId must be a valid UUID' })
  tagId?: string;

  @IsOptional()
  @IsString({ message: 'updatedSince must be a string' })
  updatedSince?: string;
}
