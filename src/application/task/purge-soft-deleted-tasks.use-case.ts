import { MAX_SYNC_WINDOW_MS } from '../../domain/shared/sync-time';
import type { Clock } from '../shared/ports/clock.port';
import type { TaskRepository } from './ports/task.repository.port';

export interface PurgeSoftDeletedTasksOutput {
  purgedCount: number;
}

export class PurgeSoftDeletedTasksUseCase {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<PurgeSoftDeletedTasksOutput> {
    const now = this.clock.now();
    const threshold = new Date(now.getTime() - MAX_SYNC_WINDOW_MS);

    const purgedCount = await this.taskRepo.deletePermanentlyBefore(threshold);

    return { purgedCount };
  }
}
