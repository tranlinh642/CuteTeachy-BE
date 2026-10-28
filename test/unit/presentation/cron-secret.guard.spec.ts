import * as crypto from 'crypto';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CronSecretGuard } from '../../../src/presentation/http/reminder/guards/cron-secret.guard';
import { CronSecretVerifier } from '../../../src/application/reminder/ports/cron-secret-verifier.port';

describe('CronSecretGuard', () => {
  const expectedSecret = 'super-secret-cron-token';
  const verifier: CronSecretVerifier = {
    verify: (secret: string): boolean => {
      if (!secret || typeof secret !== 'string' || !expectedSecret) {
        return false;
      }
      const secretBuffer = Buffer.from(secret, 'utf8');
      const expectedBuffer = Buffer.from(expectedSecret, 'utf8');
      if (secretBuffer.length !== expectedBuffer.length) {
        crypto.timingSafeEqual(secretBuffer, secretBuffer);
        return false;
      }
      return crypto.timingSafeEqual(secretBuffer, expectedBuffer);
    },
  };

  let guard: CronSecretGuard;

  beforeEach(() => {
    guard = new CronSecretGuard(verifier);
  });

  function createMockContext(headers: Record<string, string | undefined>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows request when X-Cron-Secret header matches config', () => {
    const ctx = createMockContext({
      'x-cron-secret': expectedSecret,
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows request when header casing is X-Cron-Secret', () => {
    const ctx = createMockContext({
      'X-Cron-Secret': expectedSecret,
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws UnauthorizedException when header is missing', () => {
    const ctx = createMockContext({});

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when header is incorrect (different length)', () => {
    const ctx = createMockContext({
      'x-cron-secret': 'short',
    });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when header is incorrect (same length)', () => {
    const ctx = createMockContext({
      'x-cron-secret': 'wrong-secret-cron-token',
    });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
