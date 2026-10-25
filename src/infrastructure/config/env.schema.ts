import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FE_URL: z.string().min(1, 'FE_URL is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required'),
  JWT_SECRET: z.string().default('dev-jwt-secret-key-cute-teachy-at-least-32-chars'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_TTL_REMEMBER: z.string().default('30d'),
  REFRESH_TOKEN_TTL_SESSION: z.string().default('1d'),
  EMAIL_VERIFICATION_REQUIRED: z.coerce.boolean().default(false),
  CRON_SECRET: z.string().default('dev-cron-secret-token'),
});

export type AppConfig = z.infer<typeof envSchema>;
