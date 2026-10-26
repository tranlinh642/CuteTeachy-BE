import { Module } from '@nestjs/common';
import { CLOCK, type Clock } from '../application/shared/ports/clock.port';
import {
  TEACHER_SETTINGS_READER,
  type TeacherSettingsReader,
} from '../application/settings/ports/teacher-settings.port';
import {
  INSPIRATION_REPOSITORY,
  type InspirationRepository,
} from '../application/inspiration/ports/inspiration.repository.port';
import { GetTodayInspirationUseCase } from '../application/inspiration/get-today-inspiration.use-case';
import { PrismaInspirationRepository } from '../infrastructure/persistence/prisma/repositories/prisma-inspiration.repository';
import { InspirationController } from '../presentation/http/inspiration/inspiration.controller';
import { SettingsModule } from './settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [InspirationController],
  providers: [
    {
      provide: INSPIRATION_REPOSITORY,
      useClass: PrismaInspirationRepository,
    },
    {
      provide: GetTodayInspirationUseCase,
      useFactory: (
        settingsReader: TeacherSettingsReader,
        inspirationRepo: InspirationRepository,
        clock: Clock,
      ) => new GetTodayInspirationUseCase(settingsReader, inspirationRepo, clock),
      inject: [TEACHER_SETTINGS_READER, INSPIRATION_REPOSITORY, CLOCK],
    },
  ],
  exports: [INSPIRATION_REPOSITORY, GetTodayInspirationUseCase],
})
export class InspirationModule {}
