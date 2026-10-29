import {
  TaskReminderQuery,
  TaskReminderReader,
} from '../../src/application/reminder/ports/task-reminder.port';
import { Task } from '../../src/domain/task/task.entity';

export class InMemoryTaskReminderReader implements TaskReminderReader {
  private tasks: Task[] = [];

  setTasks(tasks: Task[]): void {
    this.tasks = [...tasks];
  }

  addTask(task: Task): void {
    this.tasks.push(task);
  }

  async findUpcomingTasks(
    fromDateOrQuery?: string | TaskReminderQuery,
    toDate?: string,
  ): Promise<Task[]> {
    const query =
      typeof fromDateOrQuery === 'string'
        ? { fromDate: fromDateOrQuery, toDate: toDate ?? fromDateOrQuery }
        : (fromDateOrQuery ?? {});
    const from = query.fromDate ?? query.date;
    const to = query.toDate ?? query.date ?? from;

    if (from && to) {
      return this.tasks.filter((t) => t.date >= from && t.date <= to);
    }
    return [...this.tasks];
  }

  clear(): void {
    this.tasks = [];
  }
}
