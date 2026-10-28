import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma/prisma.service';
import {
  RateLimiter,
  RateLimitResult,
} from '../../application/account/ports/rate-limiter.port';

@Injectable()
export class PostgresRateLimiter implements RateLimiter {
  constructor(private readonly prisma: PrismaService) {}

  async consume(key: string, maxPoints: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

    const rows = await this.prisma.$queryRaw<{ count: number; expiresAt: Date }[]>`
      INSERT INTO "rate_limit_counters" ("key", "count", "expiresAt", "createdAt", "updatedAt")
      VALUES (${key}, 1, ${expiresAt}, ${now}, ${now})
      ON CONFLICT ("key") DO UPDATE
      SET "count" = CASE WHEN "rate_limit_counters"."expiresAt" <= ${now} THEN 1 ELSE "rate_limit_counters"."count" + 1 END,
          "expiresAt" = CASE WHEN "rate_limit_counters"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "rate_limit_counters"."expiresAt" END,
          "updatedAt" = ${now}
      RETURNING "count", "expiresAt";
    `;

    const row = rows[0];
    const count = Number(row?.count ?? 1);
    const resetAt = row ? new Date(row.expiresAt) : expiresAt;

    if (count > maxPoints) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, maxPoints - count),
      resetAt,
    };
  }
}
