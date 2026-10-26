import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { TagController } from '../../../src/presentation/http/tag/tag.controller';
import { CreateTagUseCase } from '../../../src/application/tag/create-tag.use-case';
import { UpdateTagUseCase } from '../../../src/application/tag/update-tag.use-case';
import { DeleteTagUseCase } from '../../../src/application/tag/delete-tag.use-case';
import { ListTagsUseCase } from '../../../src/application/tag/list-tags.use-case';
import { AccessTokenPayload } from '../../../src/application/account/ports/token.service.port';

describe('TagController', () => {
  let controller: TagController;
  let createTagUseCase: jest.Mocked<CreateTagUseCase>;
  let updateTagUseCase: jest.Mocked<UpdateTagUseCase>;
  let deleteTagUseCase: jest.Mocked<DeleteTagUseCase>;
  let listTagsUseCase: jest.Mocked<ListTagsUseCase>;

  const mockUser: AccessTokenPayload = {
    sub: 'acc-1',
  };

  const mockTagDto = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Toán 10',
    tone: 'pink' as const,
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
  };

  beforeEach(() => {
    createTagUseCase = {
      execute: jest.fn(),
    } as any;
    updateTagUseCase = {
      execute: jest.fn(),
    } as any;
    deleteTagUseCase = {
      execute: jest.fn(),
    } as any;
    listTagsUseCase = {
      execute: jest.fn(),
    } as any;

    controller = new TagController(
      createTagUseCase,
      updateTagUseCase,
      deleteTagUseCase,
      listTagsUseCase,
    );
  });

  describe('create', () => {
    it('sets status 201 when new tag is created', async () => {
      createTagUseCase.execute.mockResolvedValue({
        tag: mockTagDto,
        created: true,
      });

      const res = {
        status: jest.fn(),
      } as unknown as Response;

      const result = await controller.create(
        mockUser,
        {
          id: mockTagDto.id,
          name: 'Toán 10',
          tone: 'pink',
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(result).toEqual(mockTagDto);
    });

    it('sets status 200 when duplicate tag is returned idempotently', async () => {
      createTagUseCase.execute.mockResolvedValue({
        tag: mockTagDto,
        created: false,
      });

      const res = {
        status: jest.fn(),
      } as unknown as Response;

      const result = await controller.create(
        mockUser,
        {
          id: mockTagDto.id,
          name: 'Toán 10',
          tone: 'pink',
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(result).toEqual(mockTagDto);
    });
  });

  describe('list', () => {
    it('returns sync envelope from list use case', async () => {
      const envelope = {
        items: [mockTagDto],
        deletedIds: [],
        serverTime: '2026-10-26T12:00:00.000Z',
      };
      listTagsUseCase.execute.mockResolvedValue(envelope);

      const result = await controller.list(mockUser, { updatedSince: undefined });
      expect(result).toEqual(envelope);
      expect(listTagsUseCase.execute).toHaveBeenCalledWith({
        accountId: 'acc-1',
        updatedSince: undefined,
      });
    });
  });

  describe('update', () => {
    it('returns updated tag DTO', async () => {
      const updated = { ...mockTagDto, name: 'Toán 10 Nâng cao' };
      updateTagUseCase.execute.mockResolvedValue(updated);

      const result = await controller.update(mockUser, mockTagDto.id, {
        name: 'Toán 10 Nâng cao',
      });
      expect(result).toEqual(updated);
    });
  });

  describe('delete', () => {
    it('calls delete use case and returns void', async () => {
      deleteTagUseCase.execute.mockResolvedValue();

      await expect(controller.delete(mockUser, mockTagDto.id)).resolves.toBeUndefined();
      expect(deleteTagUseCase.execute).toHaveBeenCalledWith({
        id: mockTagDto.id,
        accountId: 'acc-1',
      });
    });
  });
});
