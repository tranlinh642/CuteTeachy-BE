import type { HealthChecker } from '../shared/ports/health-checker.port';

export class CheckHealthUseCase {
  constructor(private readonly healthChecker: HealthChecker) {}

  async execute(): Promise<boolean> {
    return this.healthChecker.isHealthy();
  }
}
