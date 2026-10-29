import { TaskReminderReader } from '../../src/application/reminder/ports/task-reminder.port';
import { Task } from '../../src/domain/task/task.entity';

export class InMemoryTaskReminderReader implements TaskReminderReader {
  private tasks: Task[] = [];

  setTasks(tasks: Task[]): void {
    this.tasks = [...tasks];
  }

  addTask(task: Task): void {
    this.tasks.push(task);
  }

  async findUpcomingTasks(fromDate?: string, toDate?: string): Promise<Task[]> {
    if (fromDate && toDate) {
      return this.tasks.filter((t) => t.date >= fromDate && t.date <= toDate);
    }
    return [...this.tasks];
  }

  clear(): void {
    this.tasks = [];
  }
}
