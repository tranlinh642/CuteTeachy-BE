import { PostgresRateLimiter } from '../../../src/infrastructure/auth/postgres-rate-limiter';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma/prisma.service';

describe('PostgresRateLimiter', () => {
  let prisma: { $queryRaw: jest.Mock };
  let rateLimiter: PostgresRateLimiter;
  let counters: Map<string, { count: number; expiresAt: Date }>;

  beforeEach(() => {
    counters = new Map();
    prisma = {
      $queryRaw: jest.fn().mockImplementation(
        async (_strings: TemplateStringsArray, key: string, expiresAt: Date, now: Date) => {
          const existing = counters.get(key);
          if (!existing || existing.expiresAt <= now) {
            const entry = { count: 1, expiresAt };
            counters.set(key, entry);
            return [entry];
          }
          existing.count += 1;
          return [existing];
        },
      ),
    };
    rateLimiter = new PostgresRateLimiter(prisma as unknown as PrismaService);
  });

  it('allows requests within limit and tracks remaining points', async () => {
    const key = `test-limiter:${Date.now()}`;
    const r1 = await rateLimiter.consume(key, 3, 10);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await rateLimiter.consume(key, 3, 10);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await rateLimiter.consume(key, 3, 10);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    const r4 = await rateLimiter.consume(key, 3, 10);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });
});
