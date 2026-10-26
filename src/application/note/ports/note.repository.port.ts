import type { Note } from '../../../domain/note/note.entity';
import type { NoteCursor } from '../note.dto';

export const NOTE_REPOSITORY = Symbol('NOTE_REPOSITORY');

export interface FindNotesOptions {
  cursor?: NoteCursor;
  limit: number;
  q?: string;
  tagId?: string;
}

export interface NoteRepository {
  findById(id: string): Promise<Note | null>;
  findByAccount(
    accountId: string,
    options: FindNotesOptions,
  ): Promise<{
    items: Note[];
    nextCursor?: NoteCursor;
  }>;
  findDeltaByAccount(
    accountId: string,
    updatedSince: Date,
  ): Promise<{
    items: Note[];
    deletedIds: string[];
  }>;
  save(note: Note): Promise<void>;
  unlinkTag(accountId: string, tagId: string, now: Date): Promise<number>;
  validateTagOwnership(accountId: string, tagIds: string[]): Promise<boolean>;
  deletePermanentlyBefore(threshold: Date): Promise<number>;
}
