import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TAG_TONES, TagTone } from '../../../domain/tag/tag-tone.vo';

export class CreateTagRequestDto {
  @IsUUID('all', { message: 'id must be a valid UUID' })
  @IsNotEmpty({ message: 'id is required' })
  id!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'name must be a string' })
  @MinLength(1, { message: 'name must be between 1 and 24 characters' })
  @MaxLength(24, { message: 'name must be between 1 and 24 characters' })
  name!: string;

  @IsIn(TAG_TONES, {
    message: 'tone must be one of pink, blue, beige, lavender, rose, mint',
  })
  tone!: TagTone;
}

export class UpdateTagRequestDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'name must be a string' })
  @MinLength(1, { message: 'name must be between 1 and 24 characters' })
  @MaxLength(24, { message: 'name must be between 1 and 24 characters' })
  name?: string;

  @IsOptional()
  @IsIn(TAG_TONES, {
    message: 'tone must be one of pink, blue, beige, lavender, rose, mint',
  })
  tone?: TagTone;
}

export class ListTagsQueryDto {
  @IsOptional()
  @IsString({ message: 'updatedSince must be a string' })
  updatedSince?: string;
}
