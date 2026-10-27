import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PushSubscriptionKeysRequestDto {
  @IsString()
  @IsNotEmpty()
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  auth!: string;
}

export class CreatePushSubscriptionRequestDto {
  @IsString()
  @IsNotEmpty()
  endpoint!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysRequestDto)
  keys!: PushSubscriptionKeysRequestDto;
}

export class DeletePushSubscriptionRequestDto {
  @IsOptional()
  @IsString()
  endpoint?: string;
}

export class DeletePushSubscriptionQueryDto {
  @IsOptional()
  @IsString()
  endpoint?: string;
}

export class VapidPublicKeyResponseDto {
  publicKey!: string;
}
