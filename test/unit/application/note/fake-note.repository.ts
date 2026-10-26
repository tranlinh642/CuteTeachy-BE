import { Note } from '../../../../src/domain/note/note.entity';
import { normalizeVietnamese } from '../../../../src/domain/note/vietnamese-normalize';
import {
  FindNotesOptions,
  NoteRepository,
} from '../../../../src/application/note/ports/note.repository.port';
import { NoteCursor } from '../../../../src/application/note/note.dto';

function cloneNote(note: Note): Note {
  return Note.reconstitute({
    id: note.id,
    accountId: note.accountId,
    title: note.title,
    content: note.content,
    checklist: [...note.checklist],
    imageUrl: note.imageUrl,
    dueDate: note.dueDate,
    completed: note.completed,
    tagIds: [...note.tagIds],
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    deletedAt: note.deletedAt ?? null,
  });
}

export class FakeNoteRepository implements NoteRepository {
  private notes = new Map<string, Note>();

  snapshot(): { notes: Map<string, Note> } {
    const copyNotes = new Map<string, Note>();
    for (const [id, note] of this.notes.entries()) {
      copyNotes.set(id, cloneNote(note));
    }
    return {
      notes: copyNotes,
    };
  }

  restore(snap: { notes: Map<string, Note> }): void {
    this.notes = new Map();
    for (const [id, note] of snap.notes.entries()) {
      this.notes.set(id, cloneNote(note));
    }
  }

  async findById(id: string): Promise<Note | null> {
    const note = this.notes.get(id);
    return note ? cloneNote(note) : null;
  }

  async findByAccount(
    accountId: string,
    options: FindNotesOptions,
  ): Promise<{ items: Note[]; nextCursor?: NoteCursor }> {
    let list = Array.from(this.notes.values()).filter(
      (n) => n.accountId === accountId && !n.isDeleted(),
    );

    if (options.tagId) {
      list = list.filter((n) => n.tagIds.includes(options.tagId!));
    }

    if (options.q) {
      const needle = normalizeVietnamese(options.q);
      list = list.filter((n) => n.getSearchContent().includes(needle));
    }

    list.sort((a, b) => {
      const timeDiff = b.updatedAt.getTime() - a.updatedAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.id.localeCompare(a.id);
    });

    if (options.cursor) {
      const cursorDate = new Date(options.cursor.updatedAt);
      list = list.filter((n) => {
        const itemTime = n.updatedAt.getTime();
        const curTime = cursorDate.getTime();
        if (itemTime < curTime) return true;
        if (itemTime === curTime && n.id < options.cursor!.id) return true;
        return false;
      });
    }

    const hasMore = list.length > options.limit;
    const items = list.slice(0, options.limit);

    let nextCursor: NoteCursor | undefined;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = {
        updatedAt: last.updatedAt.toISOString(),
        id: last.id,
      };
    }

    return { items: items.map(cloneNote), nextCursor };
  }

  async findDeltaByAccount(
    accountId: string,
    updatedSince: Date,
  ): Promise<{ items: Note[]; deletedIds: string[] }> {
    const sinceTime = updatedSince.getTime();
    const all = Array.from(this.notes.values()).filter(
      (n) => n.accountId === accountId && n.updatedAt.getTime() >= sinceTime,
    );

    const items = all
      .filter((n) => !n.isDeleted())
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
      .map(cloneNote);

    const deletedIds = all.filter((n) => n.isDeleted()).map((n) => n.id);

    return { items, deletedIds };
  }

  async save(note: Note): Promise<void> {
    this.notes.set(note.id, cloneNote(note));
  }

  async unlinkTag(accountId: string, tagId: string, now: Date): Promise<number> {
    let count = 0;
    for (const [id, note] of this.notes.entries()) {
      if (note.accountId === accountId && note.tagIds.includes(tagId)) {
        const nextTagIds = note.tagIds.filter((t) => t !== tagId);
        const updated = Note.reconstitute({
          id: note.id,
          accountId: note.accountId,
          title: note.title,
          content: note.content,
          checklist: [...note.checklist],
          imageUrl: note.imageUrl,
          dueDate: note.dueDate,
          completed: note.completed,
          tagIds: nextTagIds,
          createdAt: note.createdAt,
          updatedAt: now,
          deletedAt: note.deletedAt ?? null,
        });
        this.notes.set(id, updated);
        count++;
      }
    }
    return count;
  }

  async deletePermanentlyBefore(threshold: Date): Promise<number> {
    let count = 0;
    for (const [id, note] of this.notes.entries()) {
      if (note.deletedAt && note.deletedAt.getTime() <= threshold.getTime()) {
        this.notes.delete(id);
        count++;
      }
    }
    return count;
  }
}
