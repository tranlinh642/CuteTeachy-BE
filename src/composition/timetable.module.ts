import { Module } from '@nestjs/common';
import { CLOCK, Clock } from '../application/shared/ports/clock.port';
import {
  TIMETABLE_SLOT_REPOSITORY,
  TimetableSlotRepository,
} from '../application/timetable/ports/timetable-slot.repository.port';
import { CreateTimetableSlotUseCase } from '../application/timetable/create-timetable-slot.use-case';
import { ListTimetableSlotsUseCase } from '../application/timetable/list-timetable-slots.use-case';
import { PrismaTimetableSlotRepository } from '../infrastructure/persistence/prisma/repositories/prisma-timetable-slot.repository';
import { TimetableController } from '../presentation/http/timetable/timetable.controller';

@Module({
  controllers: [TimetableController],
  providers: [
    {
      provide: TIMETABLE_SLOT_REPOSITORY,
      useClass: PrismaTimetableSlotRepository,
    },
    {
      provide: CreateTimetableSlotUseCase,
      useFactory: (slotRepo: TimetableSlotRepository, clock: Clock) =>
        new CreateTimetableSlotUseCase(slotRepo, clock),
      inject: [TIMETABLE_SLOT_REPOSITORY, CLOCK],
    },
    {
      provide: ListTimetableSlotsUseCase,
      useFactory: (slotRepo: TimetableSlotRepository, clock: Clock) =>
        new ListTimetableSlotsUseCase(slotRepo, clock),
      inject: [TIMETABLE_SLOT_REPOSITORY, CLOCK],
    },
  ],
  exports: [TIMETABLE_SLOT_REPOSITORY],
})
export class TimetableModule {}
