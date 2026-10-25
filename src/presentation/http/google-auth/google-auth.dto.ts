import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleAuthQueryDto {
  @IsOptional()
  @IsString()
  remember?: string;
}

export class GoogleCallbackQueryDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  error?: string;
}

export class ExchangeRequestDto {
  @IsString({ message: 'code must be a string' })
  @IsNotEmpty({ message: 'code is required' })
  code!: string;
}
