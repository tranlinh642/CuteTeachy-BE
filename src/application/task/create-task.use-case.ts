import { Task } from '../../domain/task/task.entity';
import { TaskCategory } from '../../domain/task/task-category.vo';
import { TaskPriority } from '../../domain/task/task-priority.vo';
import { TaskValidationError } from '../../domain/task/task.errors';
import { checkCreationIdempotency } from '../../domain/shared/sync-idempotency';
import type { Clock } from '../shared/ports/clock.port';
import type { TaskRepository } from './ports/task.repository.port';
import type { TagRepository } from '../tag/ports/tag.repository.port';
import { TaskDto, toTaskDto } from './task.dto';

export interface CreateTaskInput {
  id: string;
  accountId: string;
  title: string;
  notes?: string | null;
  date: string;
  time?: string | null;
  category: TaskCategory;
  priority?: TaskPriority;
  completed?: boolean;
  tagIds?: string[];
}

export interface CreateTaskOutput {
  task: TaskDto;
  created: boolean;
}

export class CreateTaskUseCase {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly tagRepo: TagRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateTaskInput): Promise<CreateTaskOutput> {
    const existing = await this.taskRepo.findById(input.id);
    const idempotency = checkCreationIdempotency(existing, input.accountId);

    if (idempotency.kind === 'existing') {
      return {
        task: toTaskDto(idempotency.entity),
        created: false,
      };
    }

    if (input.tagIds && input.tagIds.length > 0) {
      const valid = await this.tagRepo.validateOwnership(input.accountId, input.tagIds);
      if (!valid) {
        throw new TaskValidationError(
          'One or more tags not found, deleted, or belong to another account',
        );
      }
    }

    const task = Task.create({
      id: input.id,
      accountId: input.accountId,
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

    return {
      task: toTaskDto(task),
      created: true,
    };
  }
}
