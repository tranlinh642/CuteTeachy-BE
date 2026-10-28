import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ClassSessionController } from '../../../src/presentation/http/class-session/class-session.controller';
import { CreateAdHocClassSessionUseCase } from '../../../src/application/class-session/create-adhoc-class-session.use-case';
import { UpdateClassSessionUseCase } from '../../../src/application/class-session/update-class-session.use-case';
import { DeleteClassSessionUseCase } from '../../../src/application/class-session/delete-class-session.use-case';
import { ListClassSessionsUseCase } from '../../../src/application/class-session/list-class-sessions.use-case';
import { ClassSessionDto } from '../../../src/application/class-session/class-session.dto';
import { AccessTokenPayload } from '../../../src/application/account/ports/token.service.port';

describe('ClassSessionController', () => {
  let controller: ClassSessionController;
  let createAdHocUseCase: jest.Mocked<CreateAdHocClassSessionUseCase>;
  let updateUseCase: jest.Mocked<UpdateClassSessionUseCase>;
  let deleteUseCase: jest.Mocked<DeleteClassSessionUseCase>;
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

  const mockResponse = () => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  beforeEach(async () => {
    createAdHocUseCase = { execute: jest.fn() } as unknown as jest.Mocked<CreateAdHocClassSessionUseCase>;
    updateUseCase = { execute: jest.fn() } as unknown as jest.Mocked<UpdateClassSessionUseCase>;
    deleteUseCase = { execute: jest.fn() } as unknown as jest.Mocked<DeleteClassSessionUseCase>;
    listClassSessionsUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ListClassSessionsUseCase>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassSessionController],
      providers: [
        { provide: CreateAdHocClassSessionUseCase, useValue: createAdHocUseCase },
        { provide: UpdateClassSessionUseCase, useValue: updateUseCase },
        { provide: DeleteClassSessionUseCase, useValue: deleteUseCase },
        { provide: ListClassSessionsUseCase, useValue: listClassSessionsUseCase },
      ],
    }).compile();

    controller = module.get<ClassSessionController>(ClassSessionController);
  });

  describe('create (POST /class-sessions)', () => {
    it('sets status 201 when created: true', async () => {
      createAdHocUseCase.execute.mockResolvedValue({
        session: mockSession,
        created: true,
      });

      const res = mockResponse();
      const result = await controller.create(
        mockUser,
        {
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          date: '2026-10-28',
          startTime: '08:00',
          endTime: '09:30',
          subject: 'Toán',
          tone: 'blue',
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(result).toEqual(mockSession);
    });

    it('sets status 200 when created: false (idempotent)', async () => {
      createAdHocUseCase.execute.mockResolvedValue({
        session: mockSession,
        created: false,
      });

      const res = mockResponse();
      const result = await controller.create(
        mockUser,
        {
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          date: '2026-10-28',
          startTime: '08:00',
          endTime: '09:30',
          subject: 'Toán',
          tone: 'blue',
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(result).toEqual(mockSession);
    });
  });

  describe('list (GET /class-sessions)', () => {
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
    });
  });

  describe('update (PATCH /class-sessions/:id)', () => {
    it('updates session and returns dto', async () => {
      updateUseCase.execute.mockResolvedValue(mockSession);

      const result = await controller.update(mockUser, mockSession.id, {
        topic: 'Bài mới',
        cancelled: false,
      });

      expect(result).toEqual(mockSession);
      expect(updateUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockSession.id,
          accountId: mockUser.sub,
          topic: 'Bài mới',
        }),
      );
    });
  });

  describe('delete (DELETE /class-sessions/:id)', () => {
    it('calls delete use case', async () => {
      deleteUseCase.execute.mockResolvedValue(undefined);

      await controller.delete(mockUser, mockSession.id);

      expect(deleteUseCase.execute).toHaveBeenCalledWith({
        id: mockSession.id,
        accountId: mockUser.sub,
      });
    });
  });
});
