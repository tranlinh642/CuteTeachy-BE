import type { Clock } from '../../src/application/shared/ports/clock.port';

export class FixedClock implements Clock {
  constructor(private readonly at: Date) {}

  now(): Date {
    return this.at;
  }
}
