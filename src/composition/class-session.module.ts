import { Module } from '@nestjs/common';
import { CLOCK, Clock } from '../application/shared/ports/clock.port';
import {
  TIMETABLE_SLOT_REPOSITORY,
  TimetableSlotRepository,
} from '../application/timetable/ports/timetable-slot.repository.port';
import { ListClassSessionsUseCase } from '../application/class-session/list-class-sessions.use-case';
import { ClassSessionController } from '../presentation/http/class-session/class-session.controller';
import { TimetableModule } from './timetable.module';

@Module({
  imports: [TimetableModule],
  controllers: [ClassSessionController],
  providers: [
    {
      provide: ListClassSessionsUseCase,
      useFactory: (slotRepo: TimetableSlotRepository, clock: Clock) =>
        new ListClassSessionsUseCase(slotRepo, clock),
      inject: [TIMETABLE_SLOT_REPOSITORY, CLOCK],
    },
  ],
})
export class ClassSessionModule {}
