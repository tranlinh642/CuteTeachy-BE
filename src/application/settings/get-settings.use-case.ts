import { SettingsRepository } from './ports/settings.repository.port';
import { SettingsDto, toSettingsDto } from './settings.dto';
import { SettingsNotFoundError } from '../../domain/settings/settings.errors';

export interface GetSettingsInput {
  accountId: string;
}

export class GetSettingsUseCase {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  async execute(input: GetSettingsInput): Promise<SettingsDto> {
    const settings = await this.settingsRepository.findByAccountId(input.accountId);
    if (!settings) {
      throw new SettingsNotFoundError();
    }
    return toSettingsDto(settings);
  }
}
