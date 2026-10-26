import { SettingsRepository } from './ports/settings.repository.port';
import { Clock } from '../shared/ports/clock.port';
import { SettingsDto, toSettingsDto } from './settings.dto';
import { SettingsNotFoundError } from '../../domain/settings/settings.errors';
import { ReminderLeadMinutes, SettingsLocale } from '../../domain/settings/settings.types';

export interface UpdateSettingsInput {
  accountId: string;
  locale?: SettingsLocale;
  timeZone?: string;
  pushEnabled?: boolean;
  reminderLeadMinutes?: ReminderLeadMinutes;
}

export class UpdateSettingsUseCase {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateSettingsInput): Promise<SettingsDto> {
    const settings = await this.settingsRepository.findByAccountId(input.accountId);
    if (!settings) {
      throw new SettingsNotFoundError();
    }

    settings.update(
      {
        locale: input.locale,
        timeZone: input.timeZone,
        pushEnabled: input.pushEnabled,
        reminderLeadMinutes: input.reminderLeadMinutes,
      },
      this.clock.now(),
    );

    await this.settingsRepository.save(settings);

    return toSettingsDto(settings);
  }
}
