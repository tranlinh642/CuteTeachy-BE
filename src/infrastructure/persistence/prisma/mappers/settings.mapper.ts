import { Settings as PrismaSettings } from '@prisma/client';
import { Settings } from '../../../../domain/settings/settings.entity';
import { ReminderLeadMinutes, SettingsLocale } from '../../../../domain/settings/settings.types';

export class SettingsMapper {
  static toDomain(raw: PrismaSettings): Settings {
    return Settings.reconstitute({
      id: raw.id,
      accountId: raw.accountId,
      locale: raw.locale as SettingsLocale,
      timeZone: raw.timeZone,
      pushEnabled: raw.pushEnabled,
      reminderLeadMinutes: raw.reminderLeadMinutes as ReminderLeadMinutes,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  static toPrismaCreate(settings: Settings) {
    return {
      ...(settings.id ? { id: settings.id } : {}),
      accountId: settings.accountId,
      locale: settings.locale,
      timeZone: settings.timeZone,
      pushEnabled: settings.pushEnabled,
      reminderLeadMinutes: settings.reminderLeadMinutes,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  static toPrismaUpdate(settings: Settings) {
    return {
      locale: settings.locale,
      timeZone: settings.timeZone,
      pushEnabled: settings.pushEnabled,
      reminderLeadMinutes: settings.reminderLeadMinutes,
      updatedAt: settings.updatedAt,
    };
  }
}
