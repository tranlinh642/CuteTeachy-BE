import {
  Task as PrismaTask,
  TaskCategory as PrismaTaskCategory,
  TaskPriority as PrismaTaskPriority,
} from '@prisma/client';
import { Task } from '../../../../domain/task/task.entity';
import { TaskCategory } from '../../../../domain/task/task-category.vo';
import { TaskPriority } from '../../../../domain/task/task-priority.vo';

export class TaskMapper {
  static toDomain(raw: PrismaTask & { tags?: { tagId: string }[] }): Task {
    return Task.reconstitute({
      id: raw.id,
      accountId: raw.accountId,
      title: raw.title,
      notes: raw.notes,
      date: raw.date,
      time: raw.time,
      category: raw.category as TaskCategory,
      priority: raw.priority as TaskPriority,
      completed: raw.completed,
      tagIds: raw.tags ? raw.tags.map((t) => t.tagId) : [],
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
    });
  }

  static toPrismaCreate(task: Task) {
    return {
      id: task.id,
      accountId: task.accountId,
      title: task.title,
      notes: task.notes,
      date: task.date,
      time: task.time,
      category: task.category as PrismaTaskCategory,
      priority: task.priority as PrismaTaskPriority,
      completed: task.completed,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      deletedAt: task.deletedAt,
    };
  }

  static toPrismaUpdate(task: Task) {
    return {
      title: task.title,
      notes: task.notes,
      date: task.date,
      time: task.time,
      category: task.category as PrismaTaskCategory,
      priority: task.priority as PrismaTaskPriority,
      completed: task.completed,
      updatedAt: task.updatedAt,
      deletedAt: task.deletedAt,
    };
  }
}
