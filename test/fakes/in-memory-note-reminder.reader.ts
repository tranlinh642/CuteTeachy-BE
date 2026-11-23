import {
  NoteReminderQuery,
  NoteReminderReader,
} from '../../src/application/reminder/ports/note-reminder.port';
import { Note } from '../../src/domain/note/note.entity';

export class InMemoryNoteReminderReader implements NoteReminderReader {
  private notes: Note[] = [];

  setNotes(notes: Note[]): void {
    this.notes = [...notes];
  }

  addNote(note: Note): void {
    this.notes.push(note);
  }

  async findUpcomingNotes(
    fromDateOrQuery?: string | NoteReminderQuery,
    toDate?: string,
  ): Promise<Note[]> {
    const query =
      typeof fromDateOrQuery === 'string'
        ? { fromDate: fromDateOrQuery, toDate: toDate ?? fromDateOrQuery }
        : (fromDateOrQuery ?? {});
    const from = query.fromDate ?? query.date;
    const to = query.toDate ?? query.date ?? from;

    if (from && to) {
      return this.notes.filter((n) => {
        if (!n.dueDate) return true;
        const dateStr = n.dueDate.slice(0, 10);
        return dateStr >= from && dateStr <= to;
      });
    }
    return [...this.notes];
  }

  clear(): void {
    this.notes = [];
  }
}
