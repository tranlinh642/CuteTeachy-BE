import { UpdateSettingsUseCase } from '../../../../src/application/settings/update-settings.use-case';
import { InMemorySettingsRepository } from '../../../fakes/in-memory-settings.repository';
import { Settings } from '../../../../src/domain/settings/settings.entity';
import { FixedClock } from '../../../fakes/fixed-clock';
import {
  SettingsNotFoundError,
  SettingsValidationError,
} from '../../../../src/domain/settings/settings.errors';

describe('UpdateSettingsUseCase', () => {
  let settingsRepo: InMemorySettingsRepository;
  let clock: FixedClock;
  let useCase: UpdateSettingsUseCase;

  beforeEach(async () => {
    settingsRepo = new InMemorySettingsRepository();
    clock = new FixedClock(new Date('2026-10-26T12:00:00.000Z'));
    useCase = new UpdateSettingsUseCase(settingsRepo, clock);

    // Seed teacher-1 with default settings
    await settingsRepo.save(
      Settings.createDefault('teacher-1', {
        now: new Date('2026-10-26T10:00:00.000Z'),
      }),
    );
  });

  it('updates partial settings: locale', async () => {
    const result = await useCase.execute({
      accountId: 'teacher-1',
      locale: 'en',
    });

    expect(result).toEqual({
      locale: 'en',
      timeZone: 'Asia/Ho_Chi_Minh',
      pushEnabled: true,
      reminderLeadMinutes: 15,
    });

    const saved = await settingsRepo.findByAccountId('teacher-1');
    expect(saved?.locale).toBe('en');
    expect(saved?.updatedAt).toEqual(clock.now());
  });

  it('updates partial settings: timeZone', async () => {
    const result = await useCase.execute({
      accountId: 'teacher-1',
      timeZone: 'America/New_York',
    });

    expect(result).toEqual({
      locale: 'vi',
      timeZone: 'America/New_York',
      pushEnabled: true,
      reminderLeadMinutes: 15,
    });
  });

  it('updates partial settings: pushEnabled & reminderLeadMinutes', async () => {
    const result = await useCase.execute({
      accountId: 'teacher-1',
      pushEnabled: false,
      reminderLeadMinutes: 30,
    });

    expect(result).toEqual({
      locale: 'vi',
      timeZone: 'Asia/Ho_Chi_Minh',
      pushEnabled: false,
      reminderLeadMinutes: 30,
    });
  });

  it('rejects invalid locale with SettingsValidationError', async () => {
    await expect(
      useCase.execute({
        accountId: 'teacher-1',
        locale: 'fr' as any,
      }),
    ).rejects.toThrow(SettingsValidationError);
  });

  it('rejects invalid timeZone with SettingsValidationError', async () => {
    await expect(
      useCase.execute({
        accountId: 'teacher-1',
        timeZone: 'Invalid/Zone',
      }),
    ).rejects.toThrow(SettingsValidationError);
  });

  it('rejects invalid reminderLeadMinutes with SettingsValidationError', async () => {
    await expect(
      useCase.execute({
        accountId: 'teacher-1',
        reminderLeadMinutes: 45 as any,
      }),
    ).rejects.toThrow(SettingsValidationError);
  });

  it('throws SettingsNotFoundError when account does not have settings', async () => {
    await expect(
      useCase.execute({
        accountId: 'non-existent',
        locale: 'en',
      }),
    ).rejects.toThrow(SettingsNotFoundError);
  });
});
