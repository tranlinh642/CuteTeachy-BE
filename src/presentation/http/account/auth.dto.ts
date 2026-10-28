import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Gender } from '../../../domain/account/profile.entity';

export class RegisterRequestDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(72, { message: 'Password must be at most 72 characters long' })
  password!: string;

  @IsOptional()
  @IsBoolean({ message: 'remember must be a boolean' })
  remember?: boolean;
}

export class LoginRequestDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString({ message: 'Password is required' })
  @IsNotEmpty({ message: 'Password cannot be empty' })
  password!: string;

  @IsOptional()
  @IsBoolean({ message: 'remember must be a boolean' })
  remember?: boolean;
}

export class RefreshTokenRequestDto {
  @IsString({ message: 'refreshToken must be a string' })
  @IsNotEmpty({ message: 'refreshToken is required' })
  refreshToken!: string;
}

export class LogoutRequestDto {
  @IsOptional()
  @IsString({ message: 'refreshToken must be a string' })
  refreshToken?: string;
}

export class UpdateProfileRequestDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'fullName must be a string' })
  @MinLength(2, { message: 'fullName must be at least 2 characters long' })
  @MaxLength(50, { message: 'fullName must be at most 50 characters long' })
  fullName?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'displayName must be a string' })
  @MinLength(1, { message: 'displayName must be at least 1 character long' })
  @MaxLength(20, { message: 'displayName must be at most 20 characters long' })
  displayName?: string;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'title must be a string' })
  @MaxLength(50, { message: 'title must be at most 50 characters long' })
  title?: string | null;

  @IsOptional()
  @IsIn(['female', 'male', 'other'], {
    message: 'gender must be one of female, male, other',
  })
  gender?: Gender;
}
