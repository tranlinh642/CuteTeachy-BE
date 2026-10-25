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

  // S3 / MinIO Object Storage
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().default('minioadmin'),
  S3_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
  S3_BUCKET: z.string().optional(),
  S3_BUCKET_AVATARS: z.string().default('avatars'),
  S3_PUBLIC_URL_PREFIX: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().default('http://localhost:9000/avatars'),
});

export type AppConfig = z.infer<typeof envSchema>;
