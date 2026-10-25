import { Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { CodeGenerator } from '../../application/verification/ports/code-generator.port';

@Injectable()
export class CryptoCodeGenerator implements CodeGenerator {
  generate(): string {
    return randomInt(100000, 1000000).toString();
  }
}
