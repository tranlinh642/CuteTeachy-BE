import { Settings } from '../../domain/settings/settings.entity';
import { ReminderLeadMinutes, SettingsLocale } from '../../domain/settings/settings.types';

export interface SettingsDto {
  locale: SettingsLocale;
  timeZone: string;
  pushEnabled: boolean;
  reminderLeadMinutes: ReminderLeadMinutes;
}

export function toSettingsDto(settings: Settings): SettingsDto {
  return {
    locale: settings.locale,
    timeZone: settings.timeZone,
    pushEnabled: settings.pushEnabled,
    reminderLeadMinutes: settings.reminderLeadMinutes,
  };
}
