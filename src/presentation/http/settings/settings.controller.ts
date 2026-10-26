import { Body, Controller, Get, Patch } from '@nestjs/common';
import { AccessTokenPayload } from '../../../application/account/ports/token.service.port';
import { GetSettingsUseCase } from '../../../application/settings/get-settings.use-case';
import { UpdateSettingsUseCase } from '../../../application/settings/update-settings.use-case';
import { CurrentUser } from '../auth/current-user.decorator';
import { ExemptOnboarding } from '../auth/exempt-onboarding.decorator';
import { SettingsResponseDto, UpdateSettingsRequestDto } from './settings.dto';

@Controller('me/settings')
@ExemptOnboarding()
export class SettingsController {
  constructor(
    private readonly getSettingsUseCase: GetSettingsUseCase,
    private readonly updateSettingsUseCase: UpdateSettingsUseCase,
  ) {}

  @Get()
  async getSettings(@CurrentUser() user: AccessTokenPayload): Promise<SettingsResponseDto> {
    return this.getSettingsUseCase.execute({ accountId: user.sub });
  }

  @Patch()
  async updateSettings(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateSettingsRequestDto,
  ): Promise<SettingsResponseDto> {
    return this.updateSettingsUseCase.execute({
      accountId: user.sub,
      locale: dto.locale,
      timeZone: dto.timeZone,
      pushEnabled: dto.pushEnabled,
      reminderLeadMinutes: dto.reminderLeadMinutes,
    });
  }
}
