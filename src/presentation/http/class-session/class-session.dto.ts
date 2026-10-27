import { IsISO8601, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

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
