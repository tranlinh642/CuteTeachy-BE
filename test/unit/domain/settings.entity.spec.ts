import { Settings } from '../../../src/domain/settings/settings.entity';
import { SettingsValidationError } from '../../../src/domain/settings/settings.errors';

describe('Settings Entity', () => {
  const accountId = 'acc-12345';
  const now = new Date('2026-10-26T12:00:00.000Z');

  describe('createDefault', () => {
    it('creates default settings with Vietnamese locale', () => {
      const settings = Settings.createDefault(accountId, { now });

      expect(settings.accountId).toBe(accountId);
      expect(settings.locale).toBe('vi');
      expect(settings.timeZone).toBe('Asia/Ho_Chi_Minh');
      expect(settings.pushEnabled).toBe(true);
      expect(settings.reminderLeadMinutes).toBe(15);
      expect(settings.createdAt).toEqual(now);
      expect(settings.updatedAt).toEqual(now);
    });

    it('creates default settings with English locale if specified', () => {
      const settings = Settings.createDefault(accountId, { locale: 'en', now });

      expect(settings.accountId).toBe(accountId);
      expect(settings.locale).toBe('en');
      expect(settings.timeZone).toBe('Asia/Ho_Chi_Minh');
      expect(settings.pushEnabled).toBe(true);
      expect(settings.reminderLeadMinutes).toBe(15);
    });

    it('throws when accountId is empty', () => {
      expect(() => Settings.createDefault('', { now })).toThrow(SettingsValidationError);
    });
  });

  describe('update', () => {
    it('updates locale to valid values (vi, en)', () => {
      const settings = Settings.createDefault(accountId, { now });
      const updateTime = new Date('2026-10-26T14:00:00.000Z');

      settings.update({ locale: 'en' }, updateTime);
      expect(settings.locale).toBe('en');
      expect(settings.updatedAt).toEqual(updateTime);

      settings.update({ locale: 'vi' }, updateTime);
      expect(settings.locale).toBe('vi');
    });

    it('rejects invalid locale', () => {
      const settings = Settings.createDefault(accountId, { now });
      expect(() => settings.update({ locale: 'fr' as any })).toThrow(SettingsValidationError);
    });

    it('updates timeZone to valid IANA timezone', () => {
      const settings = Settings.createDefault(accountId, { now });
      settings.update({ timeZone: 'America/New_York' });
      expect(settings.timeZone).toBe('America/New_York');

      settings.update({ timeZone: 'UTC' });
      expect(settings.timeZone).toBe('UTC');

      settings.update({ timeZone: 'Asia/Tokyo' });
      expect(settings.timeZone).toBe('Asia/Tokyo');
    });

    it('rejects invalid IANA timezone', () => {
      const settings = Settings.createDefault(accountId, { now });
      expect(() => settings.update({ timeZone: 'Mars/Base' })).toThrow(SettingsValidationError);
      expect(() => settings.update({ timeZone: '' })).toThrow(SettingsValidationError);
      expect(() => settings.update({ timeZone: 'GMT+7' })).toThrow(SettingsValidationError);
    });

    it('updates reminderLeadMinutes to allowed values (5, 10, 15, 30, 60)', () => {
      const settings = Settings.createDefault(accountId, { now });

      for (const mins of [5, 10, 15, 30, 60] as const) {
        settings.update({ reminderLeadMinutes: mins });
        expect(settings.reminderLeadMinutes).toBe(mins);
      }
    });

    it('rejects invalid reminderLeadMinutes', () => {
      const settings = Settings.createDefault(accountId, { now });
      expect(() => settings.update({ reminderLeadMinutes: 20 as any })).toThrow(
        SettingsValidationError,
      );
      expect(() => settings.update({ reminderLeadMinutes: 0 as any })).toThrow(
        SettingsValidationError,
      );
    });

    it('updates pushEnabled boolean', () => {
      const settings = Settings.createDefault(accountId, { now });
      settings.update({ pushEnabled: false });
      expect(settings.pushEnabled).toBe(false);

      settings.update({ pushEnabled: true });
      expect(settings.pushEnabled).toBe(true);
    });

    it('handles partial updates without touching other fields', () => {
      const settings = Settings.createDefault(accountId, { now });
      settings.update({ pushEnabled: false });

      expect(settings.locale).toBe('vi');
      expect(settings.timeZone).toBe('Asia/Ho_Chi_Minh');
      expect(settings.reminderLeadMinutes).toBe(15);
      expect(settings.pushEnabled).toBe(false);
    });
  });

  describe('reconstitute', () => {
    it('correctly reconstitutes settings entity', () => {
      const createdAt = new Date('2026-10-01T00:00:00.000Z');
      const updatedAt = new Date('2026-10-02T00:00:00.000Z');

      const settings = Settings.reconstitute({
        id: 'settings-1',
        accountId: 'acc-1',
        locale: 'en',
        timeZone: 'Europe/London',
        pushEnabled: false,
        reminderLeadMinutes: 30,
        createdAt,
        updatedAt,
      });

      expect(settings.id).toBe('settings-1');
      expect(settings.accountId).toBe('acc-1');
      expect(settings.locale).toBe('en');
      expect(settings.timeZone).toBe('Europe/London');
      expect(settings.pushEnabled).toBe(false);
      expect(settings.reminderLeadMinutes).toBe(30);
      expect(settings.createdAt).toEqual(createdAt);
      expect(settings.updatedAt).toEqual(updatedAt);
    });
  });
});
