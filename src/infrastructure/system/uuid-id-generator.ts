import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../../application/shared/ports/id-generator.port';

@Injectable()
export class UuidGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }

  generate(): string {
    return this.next();
  }
}
