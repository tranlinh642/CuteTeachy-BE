import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TaskReminderReader } from '../../../../application/reminder/ports/task-reminder.port';
import { Task } from '../../../../domain/task/task.entity';
import { TaskMapper } from '../mappers/task.mapper';

@Injectable()
export class PrismaTaskReminderReader implements TaskReminderReader {
  constructor(private readonly prisma: PrismaService) {}

  async findUpcomingTasks(): Promise<Task[]> {
    const now = new Date();
    // Allow for teacher time zones across UTC-12 to UTC+14
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const rawTasks = await this.prisma.task.findMany({
      where: {
        completed: false,
        deletedAt: null,
        time: {
          not: null,
        },
        date: {
          gte: yesterday,
          lte: tomorrow,
        },
        account: {
          settings: {
            pushEnabled: true,
          },
        },
      },
      orderBy: [
        { date: 'asc' },
        { time: 'asc' },
      ],
      include: {
        tags: true,
      },
      take: 200,
    });

    return rawTasks.map((raw) => TaskMapper.toDomain(raw));
  }
}
