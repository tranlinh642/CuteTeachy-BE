import type { Note } from '../../../domain/note/note.entity';

export const NOTE_REMINDER_READER = Symbol('NOTE_REMINDER_READER');

export interface NoteReminderReader {
  findUpcomingNotes(fromDate?: string, toDate?: string): Promise<Note[]>;
}
