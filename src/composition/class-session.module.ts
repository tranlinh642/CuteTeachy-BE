import { Module } from '@nestjs/common';
import { CLOCK, Clock } from '../application/shared/ports/clock.port';
import {
  TIMETABLE_SLOT_REPOSITORY,
  TimetableSlotRepository,
} from '../application/timetable/ports/timetable-slot.repository.port';
import {
  CLASS_SESSION_REPOSITORY,
  ClassSessionRepository,
} from '../application/class-session/ports/class-session.repository.port';
import { CreateAdHocClassSessionUseCase } from '../application/class-session/create-adhoc-class-session.use-case';
import { UpdateClassSessionUseCase } from '../application/class-session/update-class-session.use-case';
import { DeleteClassSessionUseCase } from '../application/class-session/delete-class-session.use-case';
import { ListClassSessionsUseCase } from '../application/class-session/list-class-sessions.use-case';
import { PrismaClassSessionRepository } from '../infrastructure/persistence/prisma/repositories/prisma-class-session.repository';
import { ClassSessionController } from '../presentation/http/class-session/class-session.controller';
import { TimetableModule } from './timetable.module';

@Module({
  imports: [TimetableModule],
  controllers: [ClassSessionController],
  providers: [
    {
      provide: CLASS_SESSION_REPOSITORY,
      useClass: PrismaClassSessionRepository,
    },
    {
      provide: CreateAdHocClassSessionUseCase,
      useFactory: (sessionRepo: ClassSessionRepository, clock: Clock) =>
        new CreateAdHocClassSessionUseCase(sessionRepo, clock),
      inject: [CLASS_SESSION_REPOSITORY, CLOCK],
    },
    {
      provide: UpdateClassSessionUseCase,
      useFactory: (
        sessionRepo: ClassSessionRepository,
        slotRepo: TimetableSlotRepository,
        clock: Clock,
      ) => new UpdateClassSessionUseCase(sessionRepo, slotRepo, clock),
      inject: [CLASS_SESSION_REPOSITORY, TIMETABLE_SLOT_REPOSITORY, CLOCK],
    },
    {
      provide: DeleteClassSessionUseCase,
      useFactory: (sessionRepo: ClassSessionRepository, clock: Clock) =>
        new DeleteClassSessionUseCase(sessionRepo, clock),
      inject: [CLASS_SESSION_REPOSITORY, CLOCK],
    },
    {
      provide: ListClassSessionsUseCase,
      useFactory: (
        slotRepo: TimetableSlotRepository,
        sessionRepo: ClassSessionRepository,
        clock: Clock,
      ) => new ListClassSessionsUseCase(slotRepo, sessionRepo, clock),
      inject: [TIMETABLE_SLOT_REPOSITORY, CLASS_SESSION_REPOSITORY, CLOCK],
    },
  ],
  exports: [CLASS_SESSION_REPOSITORY],
})
export class ClassSessionModule {}
