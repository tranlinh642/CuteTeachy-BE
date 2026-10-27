import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { TimetableController } from '../../../src/presentation/http/timetable/timetable.controller';
import { CreateTimetableSlotUseCase } from '../../../src/application/timetable/create-timetable-slot.use-case';
import { ListTimetableSlotsUseCase } from '../../../src/application/timetable/list-timetable-slots.use-case';
import { UpdateTimetableSlotUseCase } from '../../../src/application/timetable/update-timetable-slot.use-case';
import { DeleteTimetableSlotUseCase } from '../../../src/application/timetable/delete-timetable-slot.use-case';
import { TimetableSlotDto } from '../../../src/application/timetable/timetable-slot.dto';
import { AccessTokenPayload } from '../../../src/application/account/ports/token.service.port';

describe('TimetableController', () => {
  let controller: TimetableController;
  let createTimetableSlotUseCase: jest.Mocked<CreateTimetableSlotUseCase>;
  let listTimetableSlotsUseCase: jest.Mocked<ListTimetableSlotsUseCase>;
  let updateTimetableSlotUseCase: jest.Mocked<UpdateTimetableSlotUseCase>;
  let deleteTimetableSlotUseCase: jest.Mocked<DeleteTimetableSlotUseCase>;

  const mockUser: AccessTokenPayload = { sub: 'acc-1' };

  const mockSlotDto: TimetableSlotDto = {
    id: '11111111-1111-4111-8111-111111111111',
    weekday: 1,
    startTime: '07:30',
    endTime: '08:15',
    subject: 'Sinh học',
    grade: '10A',
    room: '302',
    tone: 'blue',
    effectiveFrom: '2026-10-01',
    effectiveTo: '2026-12-31',
    createdAt: '2026-10-27T08:00:00.000Z',
    updatedAt: '2026-10-27T08:00:00.000Z',
  };

  beforeEach(async () => {
    createTimetableSlotUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CreateTimetableSlotUseCase>;

    listTimetableSlotsUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ListTimetableSlotsUseCase>;

    updateTimetableSlotUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<UpdateTimetableSlotUseCase>;

    deleteTimetableSlotUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<DeleteTimetableSlotUseCase>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimetableController],
      providers: [
        {
          provide: CreateTimetableSlotUseCase,
          useValue: createTimetableSlotUseCase,
        },
        {
          provide: ListTimetableSlotsUseCase,
          useValue: listTimetableSlotsUseCase,
        },
        {
          provide: UpdateTimetableSlotUseCase,
          useValue: updateTimetableSlotUseCase,
        },
        {
          provide: DeleteTimetableSlotUseCase,
          useValue: deleteTimetableSlotUseCase,
        },
      ],
    }).compile();

    controller = module.get<TimetableController>(TimetableController);
  });

  describe('create', () => {
    it('returns 201 CREATED when a new slot is created', async () => {
      createTimetableSlotUseCase.execute.mockResolvedValue({
        slot: mockSlotDto,
        created: true,
      });

      const res = {
        status: jest.fn(),
      } as unknown as Response;

      const result = await controller.create(
        mockUser,
        {
          id: mockSlotDto.id,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          grade: '10A',
          room: '302',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          effectiveTo: '2026-12-31',
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(result).toEqual(mockSlotDto);
    });

    it('returns 200 OK when slot already exists idempotently', async () => {
      createTimetableSlotUseCase.execute.mockResolvedValue({
        slot: mockSlotDto,
        created: false,
      });

      const res = {
        status: jest.fn(),
      } as unknown as Response;

      const result = await controller.create(
        mockUser,
        {
          id: mockSlotDto.id,
          weekday: 1,
          startTime: '07:30',
          endTime: '08:15',
          subject: 'Sinh học',
          grade: '10A',
          room: '302',
          tone: 'blue',
          effectiveFrom: '2026-10-01',
          effectiveTo: '2026-12-31',
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(result).toEqual(mockSlotDto);
    });
  });

  describe('list', () => {
    it('returns envelope from use case', async () => {
      const envelope = {
        items: [mockSlotDto],
        deletedIds: [],
        serverTime: '2026-10-27T08:00:00.000Z',
      };
      listTimetableSlotsUseCase.execute.mockResolvedValue(envelope);

      const result = await controller.list(mockUser, { updatedSince: undefined });

      expect(result).toEqual(envelope);
      expect(listTimetableSlotsUseCase.execute).toHaveBeenCalledWith({
        accountId: mockUser.sub,
        updatedSince: undefined,
      });
    });
  });

  describe('update', () => {
    it('returns { previous, current } when slot was split', async () => {
      const splitResult = {
        previous: {
          ...mockSlotDto,
          effectiveTo: '2026-10-26',
        },
        current: {
          ...mockSlotDto,
          id: '22222222-2222-4222-8222-222222222222',
          effectiveFrom: '2026-10-27',
          subject: 'Sinh học mới',
        },
      };

      updateTimetableSlotUseCase.execute.mockResolvedValue(splitResult);

      const result = await controller.update(
        mockUser,
        mockSlotDto.id,
        {
          subject: 'Sinh học mới',
        },
      );

      expect(result).toEqual(splitResult);
      expect(updateTimetableSlotUseCase.execute).toHaveBeenCalledWith({
        id: mockSlotDto.id,
        accountId: mockUser.sub,
        subject: 'Sinh học mới',
      });
    });

    it('returns { current } when slot was edited in place', async () => {
      const inPlaceResult = {
        current: {
          ...mockSlotDto,
          subject: 'Sinh học tại chỗ',
        },
      };

      updateTimetableSlotUseCase.execute.mockResolvedValue(inPlaceResult);

      const result = await controller.update(
        mockUser,
        mockSlotDto.id,
        {
          subject: 'Sinh học tại chỗ',
        },
      );

      expect(result).toEqual(inPlaceResult);
      expect(result.previous).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('calls delete use case and returns void', async () => {
      deleteTimetableSlotUseCase.execute.mockResolvedValue(undefined);

      await controller.delete(mockUser, mockSlotDto.id);

      expect(deleteTimetableSlotUseCase.execute).toHaveBeenCalledWith({
        id: mockSlotDto.id,
        accountId: mockUser.sub,
      });
    });
  });
});
