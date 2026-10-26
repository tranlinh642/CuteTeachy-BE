import { PostgresRateLimiter } from '../../../src/infrastructure/auth/postgres-rate-limiter';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma/prisma.service';

describe('PostgresRateLimiter', () => {
  let prisma: PrismaService;
  let rateLimiter: PostgresRateLimiter;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    rateLimiter = new PostgresRateLimiter(prisma);
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      await prisma.rateLimitCounter.deleteMany({
        where: { key: { startsWith: 'test-limiter:' } },
      });
      await prisma.$disconnect();
    }
  }, 30000);

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
