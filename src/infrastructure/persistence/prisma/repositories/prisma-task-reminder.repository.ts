import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  TaskReminderQuery,
  TaskReminderReader,
} from '../../../../application/reminder/ports/task-reminder.port';
import { Task } from '../../../../domain/task/task.entity';
import { TaskMapper } from '../mappers/task.mapper';

@Injectable()
export class PrismaTaskReminderReader implements TaskReminderReader {
  constructor(private readonly prisma: PrismaService) {}

  async findUpcomingTasks(
    fromDateOrQuery: string | TaskReminderQuery,
    toDate?: string,
  ): Promise<Task[]> {
    const query =
      typeof fromDateOrQuery === 'string'
        ? { fromDate: fromDateOrQuery, toDate: toDate ?? fromDateOrQuery }
        : fromDateOrQuery;

    const effectiveFrom = query.fromDate ?? query.date;
    const effectiveTo = query.toDate ?? query.date ?? effectiveFrom;

    const rawTasks = await this.prisma.task.findMany({
      where: {
        completed: false,
        deletedAt: null,
        time: {
          not: null,
        },
        ...(effectiveFrom || effectiveTo
          ? {
              date: {
                ...(effectiveFrom ? { gte: effectiveFrom } : {}),
                ...(effectiveTo ? { lte: effectiveTo } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      include: {
        tags: true,
      },
      take: 200,
    });

    return rawTasks.map((raw) => TaskMapper.toDomain(raw));
  }
}
