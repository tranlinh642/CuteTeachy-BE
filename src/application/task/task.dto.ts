import type { Task } from '../../domain/task/task.entity';
import type { TaskCategory } from '../../domain/task/task-category.vo';
import type { TaskPriority } from '../../domain/task/task-priority.vo';

export interface TaskDto {
  id: string;
  title: string;
  notes?: string;
  date: string;
  time?: string;
  category: TaskCategory;
  priority: TaskPriority;
  completed: boolean;
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
}

export function toTaskDto(task: Task): TaskDto {
  const dto: TaskDto = {
    id: task.id,
    title: task.title,
    date: task.date,
    category: task.category,
    priority: task.priority,
    completed: task.completed,
    tagIds: [...task.tagIds],
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };

  if (task.notes !== null) {
    dto.notes = task.notes;
  }

  if (task.time !== null) {
    dto.time = task.time;
  }

  return dto;
}
