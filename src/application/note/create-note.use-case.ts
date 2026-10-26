import { checkCreationIdempotency } from '../../domain/shared/sync-idempotency';
import { Note } from '../../domain/note/note.entity';
import { NoteValidationError } from '../../domain/note/note.errors';
import type { Clock } from '../shared/ports/clock.port';
import type { NoteRepository } from './ports/note.repository.port';
import type { TagRepository } from '../tag/ports/tag.repository.port';
import { NoteDto, toNoteDto } from './note.dto';

export interface CreateNoteInput {
  id: string;
  accountId: string;
  title: string;
  content?: string | null;
  checklist?: { id: string; text: string; done: boolean }[];
  tagIds?: string[];
  dueDate?: string | null;
  completed?: boolean;
  imageUrl?: string | null;
}

export interface CreateNoteOutput {
  note: NoteDto;
  created: boolean;
}

export class CreateNoteUseCase {
  constructor(
    private readonly noteRepo: NoteRepository,
    private readonly tagRepo: TagRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateNoteInput): Promise<CreateNoteOutput> {
    const existing = await this.noteRepo.findById(input.id);
    const idempotency = checkCreationIdempotency(existing, input.accountId);

    if (idempotency.kind === 'existing') {
      return {
        note: toNoteDto(idempotency.entity),
        created: false,
      };
    }

    if (input.tagIds && input.tagIds.length > 0) {
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

    const note = Note.create({
      id: input.id,
      accountId: input.accountId,
      title: input.title,
      content: input.content,
      checklist: input.checklist,
      imageUrl: input.imageUrl,
      tagIds: input.tagIds,
      dueDate: input.dueDate,
      completed: input.completed,
      now: this.clock.now(),
    });

    await this.noteRepo.save(note);

    return {
      note: toNoteDto(note),
      created: true,
    };
  }
}
