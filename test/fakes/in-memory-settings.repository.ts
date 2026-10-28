import { SettingsRepository } from '../../src/application/settings/ports/settings.repository.port';
import { TeacherSettingsReader } from '../../src/application/settings/ports/teacher-settings.port';
import { Settings } from '../../src/domain/settings/settings.entity';

export class InMemorySettingsRepository implements SettingsRepository, TeacherSettingsReader {
  private readonly store = new Map<string, Settings>();

  async findByAccountId(accountId: string): Promise<Settings | null> {
    const existing = this.store.get(accountId);
    if (!existing) {
      return null;
    }
    return Settings.reconstitute({
      id: existing.id,
      accountId: existing.accountId,
      locale: existing.locale,
      timeZone: existing.timeZone,
      pushEnabled: existing.pushEnabled,
      reminderLeadMinutes: existing.reminderLeadMinutes,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    });
  }

  async getSettings(accountId: string): Promise<Settings | null> {
    return this.findByAccountId(accountId);
  }

  async findPushEnabledTeachers(): Promise<Settings[]> {
    return Array.from(this.store.values())
      .filter((s) => s.pushEnabled)
      .map((existing) =>
        Settings.reconstitute({
          id: existing.id,
          accountId: existing.accountId,
          locale: existing.locale,
          timeZone: existing.timeZone,
          pushEnabled: existing.pushEnabled,
          reminderLeadMinutes: existing.reminderLeadMinutes,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        }),
      );
  }

  async save(settings: Settings): Promise<void> {
    const clone = Settings.reconstitute({
      id: settings.id,
      accountId: settings.accountId,
      locale: settings.locale,
      timeZone: settings.timeZone,
      pushEnabled: settings.pushEnabled,
      reminderLeadMinutes: settings.reminderLeadMinutes,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    });
    this.store.set(settings.accountId, clone);
  }

  clear(): void {
    this.store.clear();
  }
}
