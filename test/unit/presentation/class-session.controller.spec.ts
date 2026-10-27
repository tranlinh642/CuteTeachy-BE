import { Test, TestingModule } from '@nestjs/testing';
import { ClassSessionController } from '../../../src/presentation/http/class-session/class-session.controller';
import { ListClassSessionsUseCase } from '../../../src/application/class-session/list-class-sessions.use-case';
import { ClassSessionDto } from '../../../src/application/class-session/class-session.dto';
import { AccessTokenPayload } from '../../../src/application/account/ports/token.service.port';

describe('ClassSessionController', () => {
  let controller: ClassSessionController;
  let listClassSessionsUseCase: jest.Mocked<ListClassSessionsUseCase>;

  const mockUser: AccessTokenPayload = { sub: 'acc-1' };

  const mockSession: ClassSessionDto = {
    id: '11111111-1111-4111-8111-111111111111:2026-10-26',
    timetableSlotId: '11111111-1111-4111-8111-111111111111',
    date: '2026-10-26',
    startTime: '07:30',
    endTime: '08:15',
    subject: 'Sinh học',
    grade: '10A',
    room: '302',
    tone: 'blue',
    prepItems: [],
    cancelled: false,
    updatedAt: '2026-10-27T08:00:00.000Z',
  };

  beforeEach(async () => {
    listClassSessionsUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ListClassSessionsUseCase>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassSessionController],
      providers: [
        {
          provide: ListClassSessionsUseCase,
          useValue: listClassSessionsUseCase,
        },
      ],
    }).compile();

    controller = module.get<ClassSessionController>(ClassSessionController);
  });

  describe('list', () => {
    it('returns envelope with generated sessions', async () => {
      const envelope = {
        items: [mockSession],
        deletedIds: [],
        serverTime: '2026-10-27T08:00:00.000Z',
      };
      listClassSessionsUseCase.execute.mockResolvedValue(envelope);

      const result = await controller.list(mockUser, {
        from: '2026-10-26',
        to: '2026-10-30',
      });

      expect(result).toEqual(envelope);
      expect(listClassSessionsUseCase.execute).toHaveBeenCalledWith({
        accountId: mockUser.sub,
        from: '2026-10-26',
        to: '2026-10-30',
        updatedSince: undefined,
      });
    });
  });
});
