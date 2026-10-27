import { Module } from '@nestjs/common';
import { CLOCK, Clock } from '../application/shared/ports/clock.port';
import { TASK_REPOSITORY, TaskRepository } from '../application/task/ports/task.repository.port';
import { TAG_REPOSITORY, TagRepository } from '../application/tag/ports/tag.repository.port';
import { CreateTaskUseCase } from '../application/task/create-task.use-case';
import { UpdateTaskUseCase } from '../application/task/update-task.use-case';
import { DeleteTaskUseCase } from '../application/task/delete-task.use-case';
import { ListTasksUseCase } from '../application/task/list-tasks.use-case';
import { PurgeSoftDeletedTasksUseCase } from '../application/task/purge-soft-deleted-tasks.use-case';
import { PrismaTaskRepository } from '../infrastructure/persistence/prisma/repositories/prisma-task.repository';
import { TaskController } from '../presentation/http/task/task.controller';
import { TagModule } from './tag.module';

@Module({
  imports: [TagModule],
  controllers: [TaskController],
  providers: [
    {
      provide: TASK_REPOSITORY,
      useClass: PrismaTaskRepository,
    },
    {
      provide: CreateTaskUseCase,
      useFactory: (taskRepo: TaskRepository, tagRepo: TagRepository, clock: Clock) =>
        new CreateTaskUseCase(taskRepo, tagRepo, clock),
      inject: [TASK_REPOSITORY, TAG_REPOSITORY, CLOCK],
    },
    {
      provide: UpdateTaskUseCase,
      useFactory: (taskRepo: TaskRepository, tagRepo: TagRepository, clock: Clock) =>
        new UpdateTaskUseCase(taskRepo, tagRepo, clock),
      inject: [TASK_REPOSITORY, TAG_REPOSITORY, CLOCK],
    },
    {
      provide: DeleteTaskUseCase,
      useFactory: (taskRepo: TaskRepository, clock: Clock) =>
        new DeleteTaskUseCase(taskRepo, clock),
      inject: [TASK_REPOSITORY, CLOCK],
    },
    {
      provide: ListTasksUseCase,
      useFactory: (taskRepo: TaskRepository, clock: Clock) =>
        new ListTasksUseCase(taskRepo, clock),
      inject: [TASK_REPOSITORY, CLOCK],
    },
    {
      provide: PurgeSoftDeletedTasksUseCase,
      useFactory: (taskRepo: TaskRepository, clock: Clock) =>
        new PurgeSoftDeletedTasksUseCase(taskRepo, clock),
      inject: [TASK_REPOSITORY, CLOCK],
    },
  ],
  exports: [TASK_REPOSITORY, PurgeSoftDeletedTasksUseCase],
})
export class TaskModule {}
