import { InspirationController } from '../../../src/presentation/http/inspiration/inspiration.controller';
import { GetTodayInspirationUseCase } from '../../../src/application/inspiration/get-today-inspiration.use-case';
import type { AccessTokenPayload } from '../../../src/application/account/ports/token.service.port';

describe('InspirationController', () => {
  let controller: InspirationController;
  let getTodayInspirationUseCase: jest.Mocked<GetTodayInspirationUseCase>;

  const mockUser: AccessTokenPayload = {
    sub: 'teacher-123',
  };

  beforeEach(() => {
    getTodayInspirationUseCase = {
      execute: jest.fn(),
    } as any;

    controller = new InspirationController(getTodayInspirationUseCase);
  });

  describe('GET /inspirations/today', () => {
    it('calls GetTodayInspirationUseCase with current user sub and returns response DTO', async () => {
      const mockResult = {
        id: 'insp-1',
        quote: {
          vi: 'Ảnh hưởng của một người thầy tốt không bao giờ phai nhạt.',
          en: 'The influence of a good teacher can never be erased.',
        },
        author: 'Unknown Author',
      };

      getTodayInspirationUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.getToday(mockUser);

      expect(getTodayInspirationUseCase.execute).toHaveBeenCalledWith({
        accountId: 'teacher-123',
      });
      expect(result).toEqual({
        id: 'insp-1',
        quote: {
          vi: 'Ảnh hưởng của một người thầy tốt không bao giờ phai nhạt.',
          en: 'The influence of a good teacher can never be erased.',
        },
        author: 'Unknown Author',
      });
    });
  });
});
