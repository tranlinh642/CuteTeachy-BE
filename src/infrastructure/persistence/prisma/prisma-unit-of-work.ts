import { Injectable } from '@nestjs/common';
import {
  TransactionalRepositories,
  UnitOfWork,
} from '../../../application/shared/ports/unit-of-work.port';
import { PrismaService } from './prisma.service';
import { PrismaTagRepository } from './repositories/prisma-tag.repository';
import { PrismaTaskRepository } from './repositories/prisma-task.repository';
import { PrismaNoteRepository } from './repositories/prisma-note.repository';

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const tagRepo = new PrismaTagRepository(tx);
      const taskRepo = new PrismaTaskRepository(tx);
      const noteRepo = new PrismaNoteRepository(tx);

      return work({
        tagRepo,
        taskRepo,
        noteRepo,
      });
    });
  }
}
