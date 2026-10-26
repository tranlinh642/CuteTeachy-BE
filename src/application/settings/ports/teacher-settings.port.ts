import type { Settings } from '../../../domain/settings/settings.entity';

export const TEACHER_SETTINGS_READER = Symbol('TEACHER_SETTINGS_READER');

export interface TeacherSettingsReader {
  getSettings(accountId: string): Promise<Settings | null>;
}
