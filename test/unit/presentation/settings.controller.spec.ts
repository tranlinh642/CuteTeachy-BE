import { SettingsController } from '../../../src/presentation/http/settings/settings.controller';
import { GetSettingsUseCase } from '../../../src/application/settings/get-settings.use-case';
import { UpdateSettingsUseCase } from '../../../src/application/settings/update-settings.use-case';
import { AccessTokenPayload } from '../../../src/application/account/ports/token.service.port';

describe('SettingsController', () => {
  let controller: SettingsController;
  let getSettingsUseCase: jest.Mocked<GetSettingsUseCase>;
  let updateSettingsUseCase: jest.Mocked<UpdateSettingsUseCase>;

  const mockUser: AccessTokenPayload = {
    sub: 'teacher-123',
  };

  beforeEach(() => {
    getSettingsUseCase = {
      execute: jest.fn(),
    } as any;

    updateSettingsUseCase = {
      execute: jest.fn(),
    } as any;

    controller = new SettingsController(getSettingsUseCase, updateSettingsUseCase);
  });

  describe('GET /me/settings', () => {
    it('calls GetSettingsUseCase with current user sub', async () => {
      const mockResult = {
        locale: 'vi' as const,
        timeZone: 'Asia/Ho_Chi_Minh',
        pushEnabled: true,
        reminderLeadMinutes: 15 as const,
      };
      getSettingsUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.getSettings(mockUser);

      expect(getSettingsUseCase.execute).toHaveBeenCalledWith({
        accountId: 'teacher-123',
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('PATCH /me/settings', () => {
    it('calls UpdateSettingsUseCase with current user sub and body', async () => {
      const mockResult = {
        locale: 'en' as const,
        timeZone: 'America/New_York',
        pushEnabled: false,
        reminderLeadMinutes: 30 as const,
      };
      updateSettingsUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.updateSettings(mockUser, {
        locale: 'en',
        timeZone: 'America/New_York',
        pushEnabled: false,
        reminderLeadMinutes: 30,
      });

      expect(updateSettingsUseCase.execute).toHaveBeenCalledWith({
        accountId: 'teacher-123',
        locale: 'en',
        timeZone: 'America/New_York',
        pushEnabled: false,
        reminderLeadMinutes: 30,
      });
      expect(result).toEqual(mockResult);
    });
  });
});
