import { Inject, Injectable } from '@nestjs/common';
import { TaskRepository } from '../../../../application/task/ports/task.repository.port';
import { Task } from '../../../../domain/task/task.entity';
import { PrismaService } from '../prisma.service';
import { TaskMapper } from '../mappers/task.mapper';
import { Prisma } from '@prisma/client';

export type PrismaTaskClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PrismaTaskRepository implements TaskRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaTaskClient) {}

  async findById(id: string): Promise<Task | null> {
    const raw = await this.prisma.task.findUnique({
      where: { id },
      include: { tags: true },
    });
    return raw ? TaskMapper.toDomain(raw) : null;
  }

  async findByAccountAndDateRange(
    accountId: string,
    from: string,
    to: string,
    updatedSince?: Date,
  ): Promise<{ items: Task[]; deletedIds: string[] }> {
    if (!updatedSince) {
      const rows = await this.prisma.task.findMany({
        where: {
          accountId,
          deletedAt: null,
          date: {
            gte: from,
            lte: to,
          },
        },
        include: { tags: true },
        orderBy: [{ date: 'asc' }, { time: 'asc' }, { createdAt: 'asc' }],
      });
      return {
        items: rows.map(TaskMapper.toDomain),
        deletedIds: [],
      };
    }

    const [itemsRows, deletedRows] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          accountId,
          deletedAt: null,
          date: {
            gte: from,
            lte: to,
          },
          updatedAt: { gte: updatedSince },
        },
        include: { tags: true },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.task.findMany({
        where: {
          accountId,
          deletedAt: { not: null },
          date: {
            gte: from,
            lte: to,
          },
          updatedAt: { gte: updatedSince },
        },
        select: { id: true },
      }),
    ]);

    return {
      items: itemsRows.map(TaskMapper.toDomain),
      deletedIds: deletedRows.map((r) => r.id),
    };
  }

  async save(task: Task): Promise<void> {
    const runInTx = async (tx: PrismaTaskClient) => {
      await tx.task.upsert({
        where: { id: task.id },
        create: TaskMapper.toPrismaCreate(task),
        update: TaskMapper.toPrismaUpdate(task),
      });

      await tx.taskTag.deleteMany({
        where: { taskId: task.id },
      });

      if (task.tagIds.length > 0) {
        await tx.taskTag.createMany({
          data: task.tagIds.map((tagId) => ({
            taskId: task.id,
            tagId,
          })),
          skipDuplicates: true,
        });
      }
    };

    if ('$transaction' in this.prisma && typeof (this.prisma as any).$transaction === 'function') {
      await (this.prisma as PrismaService).$transaction(async (tx) => runInTx(tx));
    } else {
      await runInTx(this.prisma);
    }
  }

  async unlinkTag(accountId: string, tagId: string, now: Date): Promise<number> {
    const matching = await this.prisma.taskTag.findMany({
      where: {
        tagId,
        task: { accountId },
      },
      select: { taskId: true },
    });

    if (matching.length === 0) {
      return 0;
    }

    const taskIds = matching.map((m) => m.taskId);

    await this.prisma.taskTag.deleteMany({
      where: {
        tagId,
        taskId: { in: taskIds },
      },
    });

    await this.prisma.task.updateMany({
      where: {
        id: { in: taskIds },
      },
      data: {
        updatedAt: now,
      },
    });

    return taskIds.length;
  }

  async deletePermanentlyBefore(threshold: Date): Promise<number> {
    const result = await this.prisma.task.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lte: threshold,
        },
      },
    });
    return result.count;
  }
}
