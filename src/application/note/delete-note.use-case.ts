import { EntityNotFoundError } from '../../domain/shared/sync.errors';
import type { Clock } from '../shared/ports/clock.port';
import type { NoteRepository } from './ports/note.repository.port';

export interface DeleteNoteInput {
  id: string;
  accountId: string;
}

export class DeleteNoteUseCase {
  constructor(
    private readonly noteRepo: NoteRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: DeleteNoteInput): Promise<void> {
    const note = await this.noteRepo.findById(input.id);

    if (!note || note.accountId !== input.accountId) {
      throw new EntityNotFoundError('Note not found');
    }

    if (note.isDeleted()) {
      return;
    }

    note.delete(this.clock.now());
    await this.noteRepo.save(note);
  }
}
