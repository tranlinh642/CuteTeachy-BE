export const RATE_LIMITER = Symbol('RATE_LIMITER');

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export interface RateLimiter {
  consume(key: string, maxPoints: number, windowSeconds: number): Promise<RateLimitResult>;
}
