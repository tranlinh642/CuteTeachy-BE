import type { Task } from '../../../domain/task/task.entity';

export const TASK_REMINDER_READER = Symbol('TASK_REMINDER_READER');

export interface TaskReminderQuery {
  fromDate?: string;
  toDate?: string;
  date?: string;
}

export interface TaskReminderReader {
  findUpcomingTasks(
    fromDateOrQuery: string | TaskReminderQuery,
    toDate?: string,
  ): Promise<Task[]>;
}
