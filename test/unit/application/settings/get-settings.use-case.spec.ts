import { GetSettingsUseCase } from '../../../../src/application/settings/get-settings.use-case';
import { InMemorySettingsRepository } from '../../../fakes/in-memory-settings.repository';
import { Settings } from '../../../../src/domain/settings/settings.entity';
import { SettingsNotFoundError } from '../../../../src/domain/settings/settings.errors';

describe('GetSettingsUseCase', () => {
  let settingsRepo: InMemorySettingsRepository;
  let useCase: GetSettingsUseCase;

  beforeEach(() => {
    settingsRepo = new InMemorySettingsRepository();
    useCase = new GetSettingsUseCase(settingsRepo);
  });

  it('returns settings for the account with all 4 fields', async () => {
    const settings = Settings.createDefault('teacher-1', { locale: 'vi' });
    await settingsRepo.save(settings);

    const result = await useCase.execute({ accountId: 'teacher-1' });

    expect(result).toEqual({
      locale: 'vi',
      timeZone: 'Asia/Ho_Chi_Minh',
      pushEnabled: true,
      reminderLeadMinutes: 15,
    });
  });

  it('throws SettingsNotFoundError when settings not found', async () => {
    await expect(useCase.execute({ accountId: 'non-existent' })).rejects.toThrow(
      SettingsNotFoundError,
    );
  });
});
