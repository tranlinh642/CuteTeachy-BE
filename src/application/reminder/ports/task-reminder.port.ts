import type { Task } from '../../../domain/task/task.entity';

export const TASK_REMINDER_READER = Symbol('TASK_REMINDER_READER');

export interface TaskReminderReader {
  findUpcomingTasks(fromDate?: string, toDate?: string): Promise<Task[]>;
}
