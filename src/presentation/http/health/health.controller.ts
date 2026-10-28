import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { CheckHealthUseCase } from '../../../application/health/check-health.use-case';
import { Public } from '../auth/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly checkHealthUseCase: CheckHealthUseCase) {}

  @Get()
  async check() {
    const isHealthy = await this.checkHealthUseCase.execute();
    if (!isHealthy) {
      throw new HttpException(
        { code: 'service_unavailable', message: 'Database is unreachable' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: 'ok' };
  }
}
