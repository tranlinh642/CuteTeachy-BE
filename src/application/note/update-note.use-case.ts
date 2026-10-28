import { EntityNotFoundError } from '../../domain/shared/sync.errors';
import { NoteValidationError } from '../../domain/note/note.errors';
import type { Clock } from '../shared/ports/clock.port';
import type { NoteRepository } from './ports/note.repository.port';
import type { TagRepository } from '../tag/ports/tag.repository.port';
import { NoteDto, toNoteDto } from './note.dto';

export interface UpdateNoteInput {
  id: string;
  accountId: string;
  title?: string;
  content?: string | null;
  checklist?: { id: string; text: string; done: boolean }[];
  tagIds?: string[];
  dueDate?: string | null;
  completed?: boolean;
  imageUrl?: string | null;
}

export class UpdateNoteUseCase {
  constructor(
    private readonly noteRepo: NoteRepository,
    private readonly tagRepo: TagRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateNoteInput): Promise<NoteDto> {
    const note = await this.noteRepo.findById(input.id);

    if (!note || note.accountId !== input.accountId || note.isDeleted()) {
      throw new EntityNotFoundError('Note not found');
    }

    if (input.tagIds !== undefined && input.tagIds.length > 0) {
      const areTagsValid = await this.tagRepo.validateOwnership(
        input.accountId,
        input.tagIds,
      );
      if (!areTagsValid) {
        throw new NoteValidationError(
          'One or more tags do not belong to account or are deleted',
        );
      }
    }

    note.update({
      title: input.title,
      content: input.content,
      checklist: input.checklist,
      tagIds: input.tagIds,
      dueDate: input.dueDate,
      completed: input.completed,
      imageUrl: input.imageUrl,
      now: this.clock.now(),
    });

    await this.noteRepo.save(note);

    return toNoteDto(note);
  }
}
