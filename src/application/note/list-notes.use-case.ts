import { SyncEnvelope } from '../../domain/shared/sync-envelope';
import { parseAndValidateUpdatedSince } from '../../domain/shared/sync-time';
import { SyncValidationError } from '../../domain/shared/sync.errors';
import { NoteValidationError } from '../../domain/note/note.errors';
import type { Clock } from '../shared/ports/clock.port';
import type { NoteRepository } from './ports/note.repository.port';
import { decodeCursor, encodeCursor, NoteDto, toNoteDto } from './note.dto';

export interface ListNotesInput {
  accountId: string;
  limit?: number;
  cursor?: string;
  q?: string;
  tagId?: string;
  updatedSince?: string;
}

export class ListNotesUseCase {
  constructor(
    private readonly noteRepo: NoteRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ListNotesInput): Promise<SyncEnvelope<NoteDto>> {
    const now = this.clock.now();

    if (input.updatedSince !== undefined && input.updatedSince !== null && input.updatedSince.trim() !== '') {
      if (
        input.cursor !== undefined ||
        input.q !== undefined ||
        input.tagId !== undefined
      ) {
        throw new SyncValidationError(
          'updatedSince cannot be combined with cursor, q, or tagId',
        );
      }

      const sinceDate = parseAndValidateUpdatedSince(input.updatedSince, now);
      const delta = await this.noteRepo.findDeltaByAccount(
        input.accountId,
        sinceDate!,
      );

      return {
        items: delta.items.map(toNoteDto),
        deletedIds: delta.deletedIds,
        serverTime: now.toISOString(),
      };
    }

    const limit = input.limit ?? 20;
    if (
      typeof limit !== 'number' ||
      isNaN(limit) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    ) {
      throw new NoteValidationError('limit must be an integer between 1 and 50');
    }

    const decodedCursor = input.cursor ? decodeCursor(input.cursor) : undefined;

    const result = await this.noteRepo.findByAccount(input.accountId, {
      cursor: decodedCursor,
      limit,
      q: input.q,
      tagId: input.tagId,
    });

    return {
      items: result.items.map(toNoteDto),
      deletedIds: [],
      nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : undefined,
      serverTime: now.toISOString(),
    };
  }
}
