import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { NoteController } from '../../../src/presentation/http/note/note.controller';
import { CreateNoteUseCase } from '../../../src/application/note/create-note.use-case';
import { UpdateNoteUseCase } from '../../../src/application/note/update-note.use-case';
import { DeleteNoteUseCase } from '../../../src/application/note/delete-note.use-case';
import { ListNotesUseCase } from '../../../src/application/note/list-notes.use-case';
import { AccessTokenPayload } from '../../../src/application/account/ports/token.service.port';
import { NoteDto } from '../../../src/application/note/note.dto';

describe('NoteController', () => {
  let controller: NoteController;
  let createNoteUseCase: jest.Mocked<CreateNoteUseCase>;
  let updateNoteUseCase: jest.Mocked<UpdateNoteUseCase>;
  let deleteNoteUseCase: jest.Mocked<DeleteNoteUseCase>;
  let listNotesUseCase: jest.Mocked<ListNotesUseCase>;

  const mockUser: AccessTokenPayload = {
    sub: 'acc-1',
  };

  const mockNoteDto: NoteDto = {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Ghi chú tuần 9',
    checklist: [],
    tagIds: [],
    completed: false,
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
  };

  beforeEach(() => {
    createNoteUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CreateNoteUseCase>;
    updateNoteUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<UpdateNoteUseCase>;
    deleteNoteUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<DeleteNoteUseCase>;
    listNotesUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ListNotesUseCase>;

    controller = new NoteController(
      createNoteUseCase,
      updateNoteUseCase,
      deleteNoteUseCase,
      listNotesUseCase,
    );
  });

  describe('create', () => {
    it('sets status 201 when new note is created', async () => {
      createNoteUseCase.execute.mockResolvedValue({
        note: mockNoteDto,
        created: true,
      });

      const res = {
        status: jest.fn(),
      } as unknown as Response;

      const result = await controller.create(
        mockUser,
        {
          id: mockNoteDto.id,
          title: 'Ghi chú tuần 9',
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(result).toEqual(mockNoteDto);
    });

    it('sets status 200 when duplicate note is returned', async () => {
      createNoteUseCase.execute.mockResolvedValue({
        note: mockNoteDto,
        created: false,
      });

      const res = {
        status: jest.fn(),
      } as unknown as Response;

      const result = await controller.create(
        mockUser,
        {
          id: mockNoteDto.id,
          title: 'Ghi chú tuần 9',
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(result).toEqual(mockNoteDto);
    });
  });

  describe('list', () => {
    it('returns envelope from use case', async () => {
      const envelope = {
        items: [mockNoteDto],
        deletedIds: [],
        serverTime: '2026-10-26T12:00:00.000Z',
      };
      listNotesUseCase.execute.mockResolvedValue(envelope);

      const result = await controller.list(mockUser, { limit: 10 });
      expect(result).toEqual(envelope);
      expect(listNotesUseCase.execute).toHaveBeenCalledWith({
        accountId: mockUser.sub,
        limit: 10,
        cursor: undefined,
        q: undefined,
        tagId: undefined,
        updatedSince: undefined,
      });
    });
  });

  describe('update', () => {
    it('delegates to updateNoteUseCase', async () => {
      updateNoteUseCase.execute.mockResolvedValue(mockNoteDto);

      const result = await controller.update(mockUser, mockNoteDto.id, {
        title: 'Mới',
      });
      expect(result).toEqual(mockNoteDto);
      expect(updateNoteUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockNoteDto.id,
          accountId: mockUser.sub,
          title: 'Mới',
        }),
      );
    });
  });

  describe('delete', () => {
    it('delegates to deleteNoteUseCase', async () => {
      deleteNoteUseCase.execute.mockResolvedValue();

      await controller.delete(mockUser, mockNoteDto.id);
      expect(deleteNoteUseCase.execute).toHaveBeenCalledWith({
        id: mockNoteDto.id,
        accountId: mockUser.sub,
      });
    });
  });
});
