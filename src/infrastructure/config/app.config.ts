import * as dotenv from 'dotenv';
import { envSchema, AppConfig } from './env.schema';

dotenv.config();

export const APP_CONFIG = Symbol('APP_CONFIG');

let cachedConfig: AppConfig | null = null;

export function loadConfig(rawEnv: Record<string, unknown> = process.env): AppConfig {
  if (cachedConfig && rawEnv === process.env) {
    return cachedConfig;
  }

  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment configuration validation failed:\n${errorDetails}`);
  }

  if (rawEnv === process.env) {
    cachedConfig = result.data;
  }
  return result.data;
}

export function resetConfigForTest(): void {
  cachedConfig = null;
}

export type { AppConfig };
