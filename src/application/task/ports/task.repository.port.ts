import type { Task } from '../../../domain/task/task.entity';

export const TASK_REPOSITORY = Symbol('TASK_REPOSITORY');

export interface TaskRepository {
  findById(id: string): Promise<Task | null>;
  findByAccountAndDateRange(
    accountId: string,
    from: string,
    to: string,
    updatedSince?: Date,
  ): Promise<{
    items: Task[];
    deletedIds: string[];
  }>;
  save(task: Task): Promise<void>;
  unlinkTag(accountId: string, tagId: string, now: Date): Promise<number>;
  deletePermanentlyBefore(threshold: Date): Promise<number>;
}
