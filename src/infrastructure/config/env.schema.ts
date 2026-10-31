import { z } from 'zod';

const DEV_DEFAULT_JWT_SECRET = 'dev-jwt-secret-key-cute-teachy-at-least-32-chars';
const DEV_DEFAULT_CRON_SECRET = 'dev-cron-secret-token';

const booleanEnv = (defaultValue = false) =>
  z
    .preprocess((val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        const lower = val.trim().toLowerCase();
        if (lower === 'true' || lower === '1') return true;
        if (lower === 'false' || lower === '0') return false;
      }
      return val;
    }, z.boolean())
    .default(defaultValue);

export const envSchema = z
  .object({
    PORT: z.coerce.number().default(4000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    FE_URL: z.string().min(1, 'FE_URL is required'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_URL: z.string().min(1, 'DIRECT_URL is required'),
    JWT_SECRET: z.string().default(DEV_DEFAULT_JWT_SECRET),
    JWT_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_TTL_REMEMBER: z.string().default('30d'),
    REFRESH_TOKEN_TTL_SESSION: z.string().default('1d'),
    EMAIL_VERIFICATION_REQUIRED: booleanEnv(false),
    CRON_SECRET: z.string().default(DEV_DEFAULT_CRON_SECRET),

    // S3 / MinIO Object Storage
    S3_ENDPOINT: z.string().default('http://localhost:9000'),
    S3_REGION: z.string().default('us-east-1'),
    S3_ACCESS_KEY_ID: z.string().default('minioadmin'),
    S3_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
    S3_BUCKET: z.string().optional(),
    S3_BUCKET_AVATARS: z.string().default('avatars'),
    S3_PUBLIC_URL_PREFIX: z.string().optional(),
    S3_PUBLIC_BASE_URL: z.string().default('http://localhost:9000/avatars'),

    // SMTP / Email
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().default(1025),
    SMTP_SECURE: booleanEnv(false),
    SMTP_USER: z.string().optional().default(''),
    SMTP_PASS: z.string().optional().default(''),
    MAIL_FROM: z.string().default('CuteTeachy <no-reply@cuteteachy.local>'),

    // Web Push / VAPID (SPEC-005)
    VAPID_PUBLIC_KEY: z
      .string()
      .default(
        'BCvaZeuosq6iWYJW-2e5dcir3JGcqrQO2oVA6PVN1e12t1MUsmkSBFeXABN-0aN1LiL3wS2Tl1e6LwfdLRmOY3Y',
      ),
    VAPID_PRIVATE_KEY: z.string().default('YVtjFEQG0EcRNl4s_8aX1gzcbNlnkLvnwSHzaC7LBfw'),
    VAPID_SUBJECT: z.string().default('mailto:dev@cuteteachy.local'),

    // Google Gemini AI Assistant (SPEC-007)
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (env.JWT_SECRET.length < 32 || env.JWT_SECRET === DEV_DEFAULT_JWT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message:
            'JWT_SECRET must be at least 32 characters and not use the default development secret in production',
        });
      }
      if (!env.CRON_SECRET || env.CRON_SECRET === DEV_DEFAULT_CRON_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CRON_SECRET'],
          message: 'CRON_SECRET must not use the default development secret in production',
        });
      }
    }
  });

export type AppConfig = z.infer<typeof envSchema>;
