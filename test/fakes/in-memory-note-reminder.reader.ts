import { NoteReminderReader } from '../../src/application/reminder/ports/note-reminder.port';
import { Note } from '../../src/domain/note/note.entity';

export class InMemoryNoteReminderReader implements NoteReminderReader {
  private notes: Note[] = [];

  setNotes(notes: Note[]): void {
    this.notes = [...notes];
  }

  addNote(note: Note): void {
    this.notes.push(note);
  }

  async findUpcomingNotes(fromDate?: string, toDate?: string): Promise<Note[]> {
    if (fromDate && toDate) {
      return this.notes.filter((n) => {
        if (!n.dueDate) return true;
        const dateStr = n.dueDate.slice(0, 10);
        return dateStr >= fromDate && dateStr <= toDate;
      });
    }
    return [...this.notes];
  }

  clear(): void {
    this.notes = [];
  }
}
