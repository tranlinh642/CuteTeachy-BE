import { Module } from '@nestjs/common';
import { HealthController } from '../presentation/http/health/health.controller';
import { CheckHealthUseCase } from '../application/health/check-health.use-case';
import { HEALTH_CHECKER, HealthChecker } from '../application/shared/ports/health-checker.port';
import { PrismaHealthChecker } from '../infrastructure/persistence/prisma/prisma-health.checker';
import { PrismaService } from '../infrastructure/persistence/prisma/prisma.service';

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: HEALTH_CHECKER,
      useFactory: (prisma: PrismaService) => new PrismaHealthChecker(prisma),
      inject: [PrismaService],
    },
    {
      provide: CheckHealthUseCase,
      useFactory: (checker: HealthChecker) => new CheckHealthUseCase(checker),
      inject: [HEALTH_CHECKER],
    },
  ],
  exports: [CheckHealthUseCase],
})
export class HealthModule {}
