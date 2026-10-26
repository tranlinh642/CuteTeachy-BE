import type { Note } from '../../domain/note/note.entity';
import { NoteValidationError } from '../../domain/note/note.errors';

export interface ChecklistItemDto {
  id: string;
  text: string;
  done: boolean;
}

export interface NoteDto {
  id: string;
  title: string;
  content?: string;
  checklist: ChecklistItemDto[];
  imageUrl?: string;
  tagIds: string[];
  dueDate?: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toNoteDto(note: Note): NoteDto {
  const dto: NoteDto = {
    id: note.id,
    title: note.title,
    checklist: note.checklist.map((item) => ({
      id: item.id,
      text: item.text,
      done: item.done,
    })),
    tagIds: [...note.tagIds],
    completed: note.completed,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };

  if (note.content !== null && note.content !== undefined) {
    dto.content = note.content;
  }
  if (note.imageUrl !== null && note.imageUrl !== undefined) {
    dto.imageUrl = note.imageUrl;
  }
  if (note.dueDate !== null && note.dueDate !== undefined) {
    dto.dueDate = note.dueDate;
  }

  return dto;
}

export interface NoteCursor {
  updatedAt: string;
  id: string;
}

export function encodeCursor(cursor: NoteCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeCursor(encoded: string): NoteCursor {
  try {
    const raw = Buffer.from(encoded, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error();
    }
    const { updatedAt, id } = parsed as Record<string, unknown>;
    if (typeof updatedAt !== 'string' || typeof id !== 'string' || !id) {
      throw new Error();
    }
    const date = new Date(updatedAt);
    if (isNaN(date.getTime())) {
      throw new Error();
    }
    return { updatedAt, id };
  } catch {
    throw new NoteValidationError('Invalid cursor');
  }
}
