import type { Note } from '../../../domain/note/note.entity';

export const NOTE_REMINDER_READER = Symbol('NOTE_REMINDER_READER');

export interface NoteReminderQuery {
  fromDate?: string;
  toDate?: string;
  date?: string;
}

export interface NoteReminderReader {
  findUpcomingNotes(
    fromDateOrQuery: string | NoteReminderQuery,
    toDate?: string,
  ): Promise<Note[]>;
}
