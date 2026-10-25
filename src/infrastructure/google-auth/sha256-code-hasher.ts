import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { CodeHasher } from '../../application/google-auth/ports/code-hasher.port';

@Injectable()
export class Sha256CodeHasher implements CodeHasher {
  hash(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }
}
