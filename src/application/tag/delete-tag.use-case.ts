import { EntityNotFoundError } from '../../domain/shared/sync.errors';
import type { Clock } from '../shared/ports/clock.port';
import type { TagRepository } from './ports/tag.repository.port';

export interface DeleteTagInput {
  id: string;
  accountId: string;
}

export class DeleteTagUseCase {
  constructor(
    private readonly tagRepo: TagRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: DeleteTagInput): Promise<void> {
    const tag = await this.tagRepo.findById(input.id);

    if (!tag || tag.accountId !== input.accountId) {
      throw new EntityNotFoundError('Tag not found');
    }

    if (tag.isDeleted()) {
      return;
    }

    tag.delete(this.clock.now());
    await this.tagRepo.save(tag);
  }
}
