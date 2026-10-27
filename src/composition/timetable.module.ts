import { Module } from '@nestjs/common';
import { CLOCK, Clock } from '../application/shared/ports/clock.port';
import { ID_GENERATOR, IdGenerator } from '../application/shared/ports/id-generator.port';
import { UNIT_OF_WORK, UnitOfWork } from '../application/shared/ports/unit-of-work.port';
import {
  TEACHER_SETTINGS_READER,
  TeacherSettingsReader,
} from '../application/settings/ports/teacher-settings.port';
import {
  TIMETABLE_SLOT_REPOSITORY,
  TimetableSlotRepository,
} from '../application/timetable/ports/timetable-slot.repository.port';
import { CreateTimetableSlotUseCase } from '../application/timetable/create-timetable-slot.use-case';
import { ListTimetableSlotsUseCase } from '../application/timetable/list-timetable-slots.use-case';
import { UpdateTimetableSlotUseCase } from '../application/timetable/update-timetable-slot.use-case';
import { DeleteTimetableSlotUseCase } from '../application/timetable/delete-timetable-slot.use-case';
import { PrismaTimetableSlotRepository } from '../infrastructure/persistence/prisma/repositories/prisma-timetable-slot.repository';
import { TimetableController } from '../presentation/http/timetable/timetable.controller';
import { SettingsModule } from './settings.module';

@Module({
  imports: [SettingsModule],
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
    {
      provide: UpdateTimetableSlotUseCase,
      useFactory: (
        uow: UnitOfWork,
        settingsReader: TeacherSettingsReader,
        idGenerator: IdGenerator,
        clock: Clock,
      ) => new UpdateTimetableSlotUseCase(uow, settingsReader, idGenerator, clock),
      inject: [UNIT_OF_WORK, TEACHER_SETTINGS_READER, ID_GENERATOR, CLOCK],
    },
    {
      provide: DeleteTimetableSlotUseCase,
      useFactory: (
        uow: UnitOfWork,
        settingsReader: TeacherSettingsReader,
        clock: Clock,
      ) => new DeleteTimetableSlotUseCase(uow, settingsReader, clock),
      inject: [UNIT_OF_WORK, TEACHER_SETTINGS_READER, CLOCK],
    },
  ],
  exports: [
    TIMETABLE_SLOT_REPOSITORY,
    CreateTimetableSlotUseCase,
    ListTimetableSlotsUseCase,
    UpdateTimetableSlotUseCase,
    DeleteTimetableSlotUseCase,
  ],
})
export class TimetableModule {}
