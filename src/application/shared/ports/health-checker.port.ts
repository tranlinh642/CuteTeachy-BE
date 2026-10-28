export const HEALTH_CHECKER = Symbol('HEALTH_CHECKER');

export interface HealthChecker {
  isHealthy(): Promise<boolean>;
}
