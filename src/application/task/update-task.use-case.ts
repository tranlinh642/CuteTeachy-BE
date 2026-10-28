import { TaskCategory } from '../../domain/task/task-category.vo';
import { TaskPriority } from '../../domain/task/task-priority.vo';
import { TaskValidationError } from '../../domain/task/task.errors';
import { EntityNotFoundError } from '../../domain/shared/sync.errors';
import type { Clock } from '../shared/ports/clock.port';
import type { TaskRepository } from './ports/task.repository.port';
import type { TagRepository } from '../tag/ports/tag.repository.port';
import { TaskDto, toTaskDto } from './task.dto';

export interface UpdateTaskInput {
  id: string;
  accountId: string;
  title?: string;
  notes?: string | null;
  date?: string;
  time?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  completed?: boolean;
  tagIds?: string[];
}

export class UpdateTaskUseCase {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly tagRepo: TagRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateTaskInput): Promise<TaskDto> {
    const task = await this.taskRepo.findById(input.id);

    if (!task || task.accountId !== input.accountId || task.isDeleted()) {
      throw new EntityNotFoundError('Task not found');
    }

    if (input.tagIds !== undefined && input.tagIds.length > 0) {
      const valid = await this.tagRepo.validateOwnership(input.accountId, input.tagIds);
      if (!valid) {
        throw new TaskValidationError(
          'One or more tags not found, deleted, or belong to another account',
        );
      }
    }

    task.update({
      title: input.title,
      notes: input.notes,
      date: input.date,
      time: input.time,
      category: input.category,
      priority: input.priority,
      completed: input.completed,
      tagIds: input.tagIds,
      now: this.clock.now(),
    });

    await this.taskRepo.save(task);

    return toTaskDto(task);
  }
}
