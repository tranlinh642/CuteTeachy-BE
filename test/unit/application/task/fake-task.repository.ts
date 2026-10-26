import { Task } from '../../../../src/domain/task/task.entity';
import { TaskRepository } from '../../../../src/application/task/ports/task.repository.port';

export class FakeTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map();
  private validTags: Map<string, { accountId: string; deleted: boolean }> = new Map();

  addValidTag(tagId: string, accountId: string, deleted = false): void {
    this.validTags.set(tagId, { accountId, deleted });
  }

  async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async findByAccountAndDateRange(
    accountId: string,
    from: string,
    to: string,
    updatedSince?: Date,
  ): Promise<{ items: Task[]; deletedIds: string[] }> {
    const items: Task[] = [];
    const deletedIds: string[] = [];

    for (const task of this.tasks.values()) {
      if (task.accountId !== accountId) continue;
      if (task.date < from || task.date > to) continue;

      if (!updatedSince) {
        if (!task.isDeleted()) {
          items.push(task);
        }
      } else {
        if (!task.isDeleted() && task.updatedAt >= updatedSince) {
          items.push(task);
        } else if (task.isDeleted() && task.updatedAt >= updatedSince) {
          deletedIds.push(task.id);
        }
      }
    }

    return { items, deletedIds };
  }

  async save(task: Task): Promise<void> {
    this.tasks.set(task.id, task);
  }

  async validateTagOwnership(accountId: string, tagIds: string[]): Promise<boolean> {
    for (const tagId of tagIds) {
      const tagInfo = this.validTags.get(tagId);
      if (!tagInfo || tagInfo.accountId !== accountId || tagInfo.deleted) {
        return false;
      }
    }
    return true;
  }

  async deletePermanentlyBefore(threshold: Date): Promise<number> {
    let count = 0;
    for (const [id, task] of Array.from(this.tasks.entries())) {
      if (task.deletedAt && task.deletedAt <= threshold) {
        this.tasks.delete(id);
        count++;
      }
    }
    return count;
  }
}
