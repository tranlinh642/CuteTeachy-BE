import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { TimetableController } from '../../../src/presentation/http/timetable/timetable.controller';
import { CreateTimetableSlotUseCase } from '../../../src/application/timetable/create-timetable-slot.use-case';
import { ListTimetableSlotsUseCase } from '../../../src/application/timetable/list-timetable-slots.use-case';
import { TimetableSlotDto } from '../../../src/application/timetable/timetable-slot.dto';
import { AccessTokenPayload } from '../../../src/application/account/ports/token.service.port';

describe('TimetableController', () => {
  let controller: TimetableController;
  let createTimetableSlotUseCase: jest.Mocked<CreateTimetableSlotUseCase>;
  let listTimetableSlotsUseCase: jest.Mocked<ListTimetableSlotsUseCase>;

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
});
