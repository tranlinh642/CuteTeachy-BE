import { SyncEnvelope } from '../../domain/shared/sync-envelope';
import { parseAndValidateUpdatedSince } from '../../domain/shared/sync-time';
import { TaskValidationError } from '../../domain/task/task.errors';
import type { Clock } from '../shared/ports/clock.port';
import type { TaskRepository } from './ports/task.repository.port';
import { TaskDto, toTaskDto } from './task.dto';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DATE_RANGE_DAYS = 42;

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
    this.validateDateRange(input.from, input.to);

    const now = this.clock.now();
    const sinceDate = parseAndValidateUpdatedSince(input.updatedSince, now);

    const result = await this.taskRepo.findByAccountAndDateRange(
      input.accountId,
      input.from,
      input.to,
      sinceDate,
    );

    return {
      items: result.items.map(toTaskDto),
      deletedIds: result.deletedIds,
      serverTime: now.toISOString(),
    };
  }

  private validateDateRange(from: string, to: string): void {
    if (!from || typeof from !== 'string' || !DATE_REGEX.test(from)) {
      throw new TaskValidationError('from must be in YYYY-MM-DD format');
    }

    if (!to || typeof to !== 'string' || !DATE_REGEX.test(to)) {
      throw new TaskValidationError('to must be in YYYY-MM-DD format');
    }

    const [fromY, fromM, fromD] = from.split('-').map(Number);
    const fromDate = new Date(Date.UTC(fromY, fromM - 1, fromD));
    if (
      fromDate.getUTCFullYear() !== fromY ||
      fromDate.getUTCMonth() !== fromM - 1 ||
      fromDate.getUTCDate() !== fromD
    ) {
      throw new TaskValidationError('from is not a valid calendar date');
    }

    const [toY, toM, toD] = to.split('-').map(Number);
    const toDate = new Date(Date.UTC(toY, toM - 1, toD));
    if (
      toDate.getUTCFullYear() !== toY ||
      toDate.getUTCMonth() !== toM - 1 ||
      toDate.getUTCDate() !== toD
    ) {
      throw new TaskValidationError('to is not a valid calendar date');
    }

    if (fromDate.getTime() > toDate.getTime()) {
      throw new TaskValidationError('from date cannot be after to date');
    }

    const diffMs = toDate.getTime() - fromDate.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays > MAX_DATE_RANGE_DAYS) {
      throw new TaskValidationError(`Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`);
    }
  }
}
