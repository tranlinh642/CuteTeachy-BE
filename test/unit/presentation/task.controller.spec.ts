import { Test, TestingModule } from '@nestjs/testing';
import { TaskController } from '../../../src/presentation/http/task/task.controller';
import { CreateTaskUseCase } from '../../../src/application/task/create-task.use-case';
import { UpdateTaskUseCase } from '../../../src/application/task/update-task.use-case';
import { DeleteTaskUseCase } from '../../../src/application/task/delete-task.use-case';
import { ListTasksUseCase } from '../../../src/application/task/list-tasks.use-case';
import { TaskDto } from '../../../src/application/task/task.dto';
import { AccessTokenPayload } from '../../../src/application/account/ports/token.service.port';
import { Response } from 'express';

describe('TaskController', () => {
  let controller: TaskController;
  let createTaskUseCase: jest.Mocked<CreateTaskUseCase>;
  let updateTaskUseCase: jest.Mocked<UpdateTaskUseCase>;
  let deleteTaskUseCase: jest.Mocked<DeleteTaskUseCase>;
  let listTasksUseCase: jest.Mocked<ListTasksUseCase>;

  const mockUser: AccessTokenPayload = {
    sub: 'acc-1',
  };

  const mockTaskDto: TaskDto = {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Task 1',
    notes: 'Some note',
    date: '2026-10-27',
    time: '09:00',
    category: 'school',
    priority: 'normal',
    completed: false,
    tagIds: [],
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
  };

  beforeEach(async () => {
    createTaskUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CreateTaskUseCase>;
    updateTaskUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<UpdateTaskUseCase>;
    deleteTaskUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<DeleteTaskUseCase>;
    listTasksUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ListTasksUseCase>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        { provide: CreateTaskUseCase, useValue: createTaskUseCase },
        { provide: UpdateTaskUseCase, useValue: updateTaskUseCase },
        { provide: DeleteTaskUseCase, useValue: deleteTaskUseCase },
        { provide: ListTasksUseCase, useValue: listTasksUseCase },
      ],
    }).compile();

    controller = module.get<TaskController>(TaskController);
  });

  describe('create', () => {
    it('returns 201 Created when task is newly created', async () => {
      createTaskUseCase.execute.mockResolvedValue({
        task: mockTaskDto,
        created: true,
      });

      const res = {
        status: jest.fn(),
      } as unknown as Response;

      const result = await controller.create(
        mockUser,
        {
          id: mockTaskDto.id,
          title: mockTaskDto.title,
          date: mockTaskDto.date,
          category: 'school',
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(201);
      expect(result).toEqual(mockTaskDto);
    });

    it('returns 200 OK when task already exists (idempotency)', async () => {
      createTaskUseCase.execute.mockResolvedValue({
        task: mockTaskDto,
        created: false,
      });

      const res = {
        status: jest.fn(),
      } as unknown as Response;

      const result = await controller.create(
        mockUser,
        {
          id: mockTaskDto.id,
          title: mockTaskDto.title,
          date: mockTaskDto.date,
          category: 'school',
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(result).toEqual(mockTaskDto);
    });
  });

  describe('list', () => {
    it('calls listTasksUseCase with correct parameters', async () => {
      const mockEnvelope = {
        items: [mockTaskDto],
        deletedIds: [],
        serverTime: '2026-10-26T12:00:00.000Z',
      };
      listTasksUseCase.execute.mockResolvedValue(mockEnvelope);

      const result = await controller.list(mockUser, {
        from: '2026-10-01',
        to: '2026-10-31',
        updatedSince: '2026-10-20T00:00:00.000Z',
      });

      expect(listTasksUseCase.execute).toHaveBeenCalledWith({
        accountId: 'acc-1',
        from: '2026-10-01',
        to: '2026-10-31',
        updatedSince: '2026-10-20T00:00:00.000Z',
      });
      expect(result).toEqual(mockEnvelope);
    });
  });

  describe('update', () => {
    it('calls updateTaskUseCase with correct parameters', async () => {
      const updatedDto = { ...mockTaskDto, title: 'Updated' };
      updateTaskUseCase.execute.mockResolvedValue(updatedDto);

      const result = await controller.update(mockUser, mockTaskDto.id, {
        title: 'Updated',
      });

      expect(updateTaskUseCase.execute).toHaveBeenCalledWith({
        id: mockTaskDto.id,
        accountId: 'acc-1',
        title: 'Updated',
      });
      expect(result).toEqual(updatedDto);
    });

    it('allows passing null for notes and time to clear them', async () => {
      const updatedDto = { ...mockTaskDto, notes: undefined, time: undefined };
      updateTaskUseCase.execute.mockResolvedValue(updatedDto);

      const result = await controller.update(mockUser, mockTaskDto.id, {
        notes: null,
        time: null,
      });

      expect(updateTaskUseCase.execute).toHaveBeenCalledWith({
        id: mockTaskDto.id,
        accountId: 'acc-1',
        notes: null,
        time: null,
      });
      expect(result).toEqual(updatedDto);
    });
  });

  describe('delete', () => {
    it('calls deleteTaskUseCase with correct parameters', async () => {
      deleteTaskUseCase.execute.mockResolvedValue(undefined);

      await controller.delete(mockUser, mockTaskDto.id);

      expect(deleteTaskUseCase.execute).toHaveBeenCalledWith({
        id: mockTaskDto.id,
        accountId: 'acc-1',
      });
    });
  });
});
