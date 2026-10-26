import { EntityNotFoundError } from '../../domain/shared/sync.errors';
import type { Clock } from '../shared/ports/clock.port';
import type { TaskRepository } from './ports/task.repository.port';

export interface DeleteTaskInput {
  id: string;
  accountId: string;
}

export class DeleteTaskUseCase {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: DeleteTaskInput): Promise<void> {
    const task = await this.taskRepo.findById(input.id);

    if (!task || task.accountId !== input.accountId) {
      throw new EntityNotFoundError('Task not found');
    }

    if (task.isDeleted()) {
      return;
    }

    task.delete(this.clock.now());
    await this.taskRepo.save(task);
  }
}
