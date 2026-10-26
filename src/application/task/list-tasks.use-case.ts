import { SyncEnvelope } from '../../domain/shared/sync-envelope';
import { parseAndValidateUpdatedSince } from '../../domain/shared/sync-time';
import { DateRange } from '../../domain/task/date-range.vo';
import type { Clock } from '../shared/ports/clock.port';
import type { TaskRepository } from './ports/task.repository.port';
import { TaskDto, toTaskDto } from './task.dto';

export interface ListTasksInput {
  accountId: string;
  from: string;
  to: string;
  updatedSince?: string;
}

export class ListTasksUseCase {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ListTasksInput): Promise<SyncEnvelope<TaskDto>> {
    const range = DateRange.create(input.from, input.to);

    const now = this.clock.now();
    const sinceDate = parseAndValidateUpdatedSince(input.updatedSince, now);

    const result = await this.taskRepo.findByAccountAndDateRange(
      input.accountId,
      range.from,
      range.to,
      sinceDate,
    );

    return {
      items: result.items.map(toTaskDto),
      deletedIds: result.deletedIds,
      serverTime: now.toISOString(),
    };
  }
}
