import { IsBoolean, IsIn, IsOptional, IsTimeZone } from 'class-validator';
import {
  REMINDER_LEAD_MINUTES,
  ReminderLeadMinutes,
  SETTINGS_LOCALES,
  SettingsLocale,
} from '../../../domain/settings/settings.types';

export class UpdateSettingsRequestDto {
  @IsOptional()
  @IsIn(SETTINGS_LOCALES, {
    message: 'locale must be vi or en',
  })
  locale?: SettingsLocale;

  @IsOptional()
  @IsTimeZone({
    message: 'timeZone must be a valid IANA time zone',
  })
  timeZone?: string;

  @IsOptional()
  @IsBoolean({
    message: 'pushEnabled must be a boolean',
  })
  pushEnabled?: boolean;

  @IsOptional()
  @IsIn(REMINDER_LEAD_MINUTES, {
    message: 'reminderLeadMinutes must be one of 5, 10, 15, 30, 60',
  })
  reminderLeadMinutes?: ReminderLeadMinutes;
}

export interface SettingsResponseDto {
  locale: SettingsLocale;
  timeZone: string;
  pushEnabled: boolean;
  reminderLeadMinutes: ReminderLeadMinutes;
}
