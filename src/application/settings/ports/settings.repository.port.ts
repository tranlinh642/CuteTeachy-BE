import type { Settings } from '../../../domain/settings/settings.entity';

export const SETTINGS_REPOSITORY = Symbol('SETTINGS_REPOSITORY');

export interface SettingsRepository {
  findByAccountId(accountId: string): Promise<Settings | null>;
  save(settings: Settings): Promise<void>;
}
