import { Module } from '@nestjs/common';
import { CLOCK, Clock } from '../application/shared/ports/clock.port';
import { UNIT_OF_WORK, UnitOfWork } from '../application/shared/ports/unit-of-work.port';
import { TAG_REPOSITORY, TagRepository } from '../application/tag/ports/tag.repository.port';
import { CreateTagUseCase } from '../application/tag/create-tag.use-case';
import { UpdateTagUseCase } from '../application/tag/update-tag.use-case';
import { DeleteTagUseCase } from '../application/tag/delete-tag.use-case';
import { ListTagsUseCase } from '../application/tag/list-tags.use-case';
import { PurgeSoftDeletedTagsUseCase } from '../application/tag/purge-soft-deleted-tags.use-case';
import { PrismaTagRepository } from '../infrastructure/persistence/prisma/repositories/prisma-tag.repository';
import { TagController } from '../presentation/http/tag/tag.controller';

@Module({
  controllers: [TagController],
  providers: [
    {
      provide: TAG_REPOSITORY,
      useClass: PrismaTagRepository,
    },
    {
      provide: CreateTagUseCase,
      useFactory: (tagRepo: TagRepository, clock: Clock) => new CreateTagUseCase(tagRepo, clock),
      inject: [TAG_REPOSITORY, CLOCK],
    },
    {
      provide: UpdateTagUseCase,
      useFactory: (tagRepo: TagRepository, clock: Clock) => new UpdateTagUseCase(tagRepo, clock),
      inject: [TAG_REPOSITORY, CLOCK],
    },
    {
      provide: DeleteTagUseCase,
      useFactory: (uow: UnitOfWork, clock: Clock) => new DeleteTagUseCase(uow, clock),
      inject: [UNIT_OF_WORK, CLOCK],
    },
    {
      provide: ListTagsUseCase,
      useFactory: (tagRepo: TagRepository, clock: Clock) => new ListTagsUseCase(tagRepo, clock),
      inject: [TAG_REPOSITORY, CLOCK],
    },
    {
      provide: PurgeSoftDeletedTagsUseCase,
      useFactory: (tagRepo: TagRepository, clock: Clock) =>
        new PurgeSoftDeletedTagsUseCase(tagRepo, clock),
      inject: [TAG_REPOSITORY, CLOCK],
    },
  ],
  exports: [TAG_REPOSITORY, PurgeSoftDeletedTagsUseCase],
})
export class TagModule {}
