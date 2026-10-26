import { Task } from '../../../../src/domain/task/task.entity';
import { TaskRepository } from '../../../../src/application/task/ports/task.repository.port';

function cloneTask(task: Task): Task {
  return Task.reconstitute({
    id: task.id,
    accountId: task.accountId,
    title: task.title,
    notes: task.notes,
    date: task.date,
    time: task.time,
    category: task.category,
    priority: task.priority,
    completed: task.completed,
    tagIds: [...task.tagIds],
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    deletedAt: task.deletedAt ?? null,
  });
}

export class FakeTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map();
  private validTags: Map<string, { accountId: string; deleted: boolean }> = new Map();

  snapshot(): { tasks: Map<string, Task>; validTags: Map<string, { accountId: string; deleted: boolean }> } {
    const copyTasks = new Map<string, Task>();
    for (const [id, task] of this.tasks.entries()) {
      copyTasks.set(id, cloneTask(task));
    }
    return {
      tasks: copyTasks,
      validTags: new Map(this.validTags),
    };
  }

  restore(snap: { tasks: Map<string, Task>; validTags: Map<string, { accountId: string; deleted: boolean }> }): void {
    this.tasks = new Map();
    for (const [id, task] of snap.tasks.entries()) {
      this.tasks.set(id, cloneTask(task));
    }
    this.validTags = new Map(snap.validTags);
  }

  addValidTag(tagId: string, accountId: string, deleted = false): void {
    this.validTags.set(tagId, { accountId, deleted });
  }

  async findById(id: string): Promise<Task | null> {
    const task = this.tasks.get(id);
    return task ? cloneTask(task) : null;
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
          items.push(cloneTask(task));
        }
      } else {
        if (!task.isDeleted() && task.updatedAt >= updatedSince) {
          items.push(cloneTask(task));
        } else if (task.isDeleted() && task.updatedAt >= updatedSince) {
          deletedIds.push(task.id);
        }
      }
    }

    return { items, deletedIds };
  }

  async save(task: Task): Promise<void> {
    this.tasks.set(task.id, cloneTask(task));
  }

  async unlinkTag(accountId: string, tagId: string, now: Date): Promise<number> {
    let count = 0;
    for (const [id, task] of this.tasks.entries()) {
      if (task.accountId === accountId && task.tagIds.includes(tagId)) {
        const nextTagIds = task.tagIds.filter((t) => t !== tagId);
        const updated = Task.reconstitute({
          id: task.id,
          accountId: task.accountId,
          title: task.title,
          notes: task.notes,
          date: task.date,
          time: task.time,
          category: task.category,
          priority: task.priority,
          completed: task.completed,
          tagIds: nextTagIds,
          createdAt: task.createdAt,
          updatedAt: now,
          deletedAt: task.deletedAt ?? null,
        });
        this.tasks.set(id, updated);
        count++;
      }
    }
    return count;
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
