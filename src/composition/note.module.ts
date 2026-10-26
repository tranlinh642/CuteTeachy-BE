import { Module } from '@nestjs/common';
import { CLOCK, Clock } from '../application/shared/ports/clock.port';
import {
  NOTE_REPOSITORY,
  NoteRepository,
} from '../application/note/ports/note.repository.port';
import { CreateNoteUseCase } from '../application/note/create-note.use-case';
import { UpdateNoteUseCase } from '../application/note/update-note.use-case';
import { DeleteNoteUseCase } from '../application/note/delete-note.use-case';
import { ListNotesUseCase } from '../application/note/list-notes.use-case';
import { PrismaNoteRepository } from '../infrastructure/persistence/prisma/repositories/prisma-note.repository';
import { NoteController } from '../presentation/http/note/note.controller';

@Module({
  controllers: [NoteController],
  providers: [
    {
      provide: NOTE_REPOSITORY,
      useClass: PrismaNoteRepository,
    },
    {
      provide: CreateNoteUseCase,
      useFactory: (noteRepo: NoteRepository, clock: Clock) =>
        new CreateNoteUseCase(noteRepo, clock),
      inject: [NOTE_REPOSITORY, CLOCK],
    },
    {
      provide: UpdateNoteUseCase,
      useFactory: (noteRepo: NoteRepository, clock: Clock) =>
        new UpdateNoteUseCase(noteRepo, clock),
      inject: [NOTE_REPOSITORY, CLOCK],
    },
    {
      provide: DeleteNoteUseCase,
      useFactory: (noteRepo: NoteRepository, clock: Clock) =>
        new DeleteNoteUseCase(noteRepo, clock),
      inject: [NOTE_REPOSITORY, CLOCK],
    },
    {
      provide: ListNotesUseCase,
      useFactory: (noteRepo: NoteRepository, clock: Clock) =>
        new ListNotesUseCase(noteRepo, clock),
      inject: [NOTE_REPOSITORY, CLOCK],
    },
  ],
  exports: [NOTE_REPOSITORY],
})
export class NoteModule {}
