import {
  RateLimiter,
  RateLimitResult,
} from '../../src/application/account/ports/rate-limiter.port';

export class FakeRateLimiter implements RateLimiter {
  private blockedKeys = new Set<string>();

  blockKey(key: string) {
    this.blockedKeys.add(key);
  }

  reset() {
    this.blockedKeys.clear();
  }

  async consume(key: string, maxPoints: number, windowSeconds: number): Promise<RateLimitResult> {
    if (this.blockedKeys.has(key)) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + windowSeconds * 1000),
      };
    }
    return {
      allowed: true,
      remaining: maxPoints - 1,
      resetAt: new Date(Date.now() + windowSeconds * 1000),
    };
  }
}
