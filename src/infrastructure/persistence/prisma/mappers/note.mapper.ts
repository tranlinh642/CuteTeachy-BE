import { Note as PrismaNote, Prisma } from '@prisma/client';
import { Note } from '../../../../domain/note/note.entity';
import { ChecklistItem } from '../../../../domain/note/checklist-item.vo';

export type PrismaNoteWithTags = PrismaNote & {
  tags?: { tagId: string }[];
};

export class NoteMapper {
  static toDomain(raw: PrismaNoteWithTags): Note {
    let checklist: ChecklistItem[] = [];
    if (Array.isArray(raw.checklist)) {
      checklist = (raw.checklist as unknown as Record<string, unknown>[]).map(
        (item) => ({
          id: String(item.id),
          text: String(item.text),
          done: Boolean(item.done),
        }),
      );
    }

    return Note.reconstitute({
      id: raw.id,
      accountId: raw.accountId,
      title: raw.title,
      content: raw.content,
      checklist,
      imageUrl: raw.imageUrl,
      tagIds: raw.tags ? raw.tags.map((t) => t.tagId) : [],
      dueDate: raw.dueDate,
      completed: raw.completed,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
    });
  }

  static toPrismaCreate(note: Note): Prisma.NoteUncheckedCreateInput {
    return {
      id: note.id,
      accountId: note.accountId,
      title: note.title,
      content: note.content,
      checklist: note.checklist as unknown as Prisma.InputJsonValue,
      imageUrl: note.imageUrl,
      dueDate: note.dueDate,
      completed: note.completed,
      searchContent: note.getSearchContent(),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      deletedAt: note.deletedAt,
    };
  }

  static toPrismaUpdate(note: Note): Prisma.NoteUncheckedUpdateInput {
    return {
      title: note.title,
      content: note.content,
      checklist: note.checklist as unknown as Prisma.InputJsonValue,
      imageUrl: note.imageUrl,
      dueDate: note.dueDate,
      completed: note.completed,
      searchContent: note.getSearchContent(),
      updatedAt: note.updatedAt,
      deletedAt: note.deletedAt,
    };
  }
}
