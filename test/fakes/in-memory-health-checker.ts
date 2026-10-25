import type { HealthChecker } from '../../src/application/shared/ports/health-checker.port';

export class InMemoryHealthChecker implements HealthChecker {
  constructor(private healthy = true) {}

  setHealthy(value: boolean): void {
    this.healthy = value;
  }

  async isHealthy(): Promise<boolean> {
    return this.healthy;
  }
}
