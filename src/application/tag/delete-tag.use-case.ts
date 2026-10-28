import { EntityNotFoundError } from '../../domain/shared/sync.errors';
import type { Clock } from '../shared/ports/clock.port';
import type { UnitOfWork } from '../shared/ports/unit-of-work.port';

export interface DeleteTagInput {
  id: string;
  accountId: string;
}

export class DeleteTagUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: DeleteTagInput): Promise<void> {
    const now = this.clock.now();

    await this.uow.run(async (repos) => {
      const tag = await repos.tagRepo.findById(input.id);

      if (!tag || tag.accountId !== input.accountId) {
        throw new EntityNotFoundError('Tag not found');
      }

      if (tag.isDeleted()) {
        return;
      }

      tag.delete(now);
      await repos.tagRepo.save(tag);

      await repos.taskRepo.unlinkTag(input.accountId, input.id, now);
      await repos.noteRepo.unlinkTag(input.accountId, input.id, now);
    });
  }
}
