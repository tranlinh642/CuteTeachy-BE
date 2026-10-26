import { Module } from '@nestjs/common';
import { CLOCK, Clock } from '../application/shared/ports/clock.port';
import {
  SETTINGS_REPOSITORY,
  SettingsRepository,
} from '../application/settings/ports/settings.repository.port';
import {
  TEACHER_SETTINGS_READER,
} from '../application/settings/ports/teacher-settings.port';
import { GetSettingsUseCase } from '../application/settings/get-settings.use-case';
import { UpdateSettingsUseCase } from '../application/settings/update-settings.use-case';
import { PrismaSettingsRepository } from '../infrastructure/persistence/prisma/repositories/prisma-settings.repository';
import { SettingsController } from '../presentation/http/settings/settings.controller';

@Module({
  controllers: [SettingsController],
  providers: [
    {
      provide: SETTINGS_REPOSITORY,
      useClass: PrismaSettingsRepository,
    },
    {
      provide: TEACHER_SETTINGS_READER,
      useExisting: SETTINGS_REPOSITORY,
    },
    {
      provide: GetSettingsUseCase,
      useFactory: (settingsRepo: SettingsRepository) => new GetSettingsUseCase(settingsRepo),
      inject: [SETTINGS_REPOSITORY],
    },
    {
      provide: UpdateSettingsUseCase,
      useFactory: (settingsRepo: SettingsRepository, clock: Clock) =>
        new UpdateSettingsUseCase(settingsRepo, clock),
      inject: [SETTINGS_REPOSITORY, CLOCK],
    },
  ],
  exports: [SETTINGS_REPOSITORY, TEACHER_SETTINGS_READER, GetSettingsUseCase, UpdateSettingsUseCase],
})
export class SettingsModule {}
