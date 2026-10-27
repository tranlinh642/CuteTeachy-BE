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

  async findUpcomingTasks(): Promise<Task[]> {
    return [...this.tasks];
  }

  clear(): void {
    this.tasks = [];
  }
}
