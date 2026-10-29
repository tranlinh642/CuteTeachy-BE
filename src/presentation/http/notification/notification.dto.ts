import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import type { InAppNotificationDto } from '../../../application/notification/notification.dto';

export class ListNotificationsQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') return true;
      if (normalized === 'false' || normalized === '0') return false;
    }
    return value;
  })
  @IsBoolean({ message: 'unreadOnly must be a boolean' })
  unreadOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : undefined))
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  limit?: number;
}

export interface ListNotificationsResponseDto {
  items: InAppNotificationDto[];
  unreadCount: number;
}

export interface MarkAllNotificationsReadResponseDto {
  updatedCount: number;
}
