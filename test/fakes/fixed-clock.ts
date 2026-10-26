import type { Clock } from '../../src/application/shared/ports/clock.port';

export class FixedClock implements Clock {
  constructor(private at: Date) {}

  now(): Date {
    return this.at;
  }

  set(at: Date): void {
    this.at = at;
  }

  advance(ms: number): void {
    this.at = new Date(this.at.getTime() + ms);
  }
}
