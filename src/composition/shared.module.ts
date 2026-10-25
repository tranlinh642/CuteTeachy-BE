import { Global, Module } from '@nestjs/common';
import { CLOCK } from '../application/shared/ports/clock.port';
import { ID_GENERATOR } from '../application/shared/ports/id-generator.port';
import { MAILER } from '../application/shared/ports/mailer.port';
import { SystemClock } from '../infrastructure/system/system-clock';
import { UuidGenerator } from '../infrastructure/system/uuid-id-generator';
import { SmtpMailer } from '../infrastructure/email/smtp-mailer';
import { PrismaService } from '../infrastructure/persistence/prisma/prisma.service';
import { APP_CONFIG, loadConfig } from '../infrastructure/config/app.config';

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: () => loadConfig(),
    },
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
    {
      provide: ID_GENERATOR,
      useClass: UuidGenerator,
    },
    {
      provide: MAILER,
      useClass: SmtpMailer,
    },
    PrismaService,
  ],
  exports: [APP_CONFIG, CLOCK, ID_GENERATOR, MAILER, PrismaService],
})
export class SharedModule {}
