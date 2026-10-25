import type { IdGenerator } from '../../src/application/shared/ports/id-generator.port';

export class SequentialIdGenerator implements IdGenerator {
  private count = 0;

  constructor(private readonly prefix = 'test-id') {}

  next(): string {
    this.count += 1;
    return `${this.prefix}-${this.count}`;
  }

  generate(): string {
    return this.next();
  }
}
