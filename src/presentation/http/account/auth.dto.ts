import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

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
