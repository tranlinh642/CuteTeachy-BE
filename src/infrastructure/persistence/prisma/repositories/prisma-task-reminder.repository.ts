import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TaskReminderReader } from '../../../../application/reminder/ports/task-reminder.port';
import { Task } from '../../../../domain/task/task.entity';
import { TaskMapper } from '../mappers/task.mapper';

@Injectable()
export class PrismaTaskReminderReader implements TaskReminderReader {
  constructor(private readonly prisma: PrismaService) {}

  async findUpcomingTasks(): Promise<Task[]> {
    const rawTasks = await this.prisma.task.findMany({
      where: {
        completed: false,
        deletedAt: null,
        time: {
          not: null,
        },
      },
      include: {
        tags: true,
      },
      take: 100,
    });

    return rawTasks.map((raw) => TaskMapper.toDomain(raw));
  }
}
