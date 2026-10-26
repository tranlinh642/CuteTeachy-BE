import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { TaskController } from '../../../src/presentation/http/task/task.controller';
import { CreateTaskUseCase } from '../../../src/application/task/create-task.use-case';
import { UpdateTaskUseCase } from '../../../src/application/task/update-task.use-case';
import { DeleteTaskUseCase } from '../../../src/application/task/delete-task.use-case';
import { ListTasksUseCase } from '../../../src/application/task/list-tasks.use-case';
import { AccessTokenPayload } from '../../../src/application/account/ports/token.service.port';
import { TaskDto } from '../../../src/application/task/task.dto';

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
    title: 'Soạn giáo án',
    date: '2026-10-27',
    category: 'school',
    priority: 'normal',
    completed: false,
    tagIds: [],
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
  };

  beforeEach(() => {
    createTaskUseCase = {
      execute: jest.fn(),
    } as any;
    updateTaskUseCase = {
      execute: jest.fn(),
    } as any;
    deleteTaskUseCase = {
      execute: jest.fn(),
    } as any;
    listTasksUseCase = {
      execute: jest.fn(),
    } as any;

    controller = new TaskController(
      createTaskUseCase,
      updateTaskUseCase,
      deleteTaskUseCase,
      listTasksUseCase,
    );
  });

  describe('create', () => {
    it('sets status 201 when new task is created', async () => {
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
          title: 'Soạn giáo án',
          date: '2026-10-27',
          category: 'school',
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(result).toEqual(mockTaskDto);
    });

    it('sets status 200 when duplicate task is returned', async () => {
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
          title: 'Soạn giáo án',
          date: '2026-10-27',
          category: 'school',
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
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
