import { loadConfig, resetConfigForTest } from '../../src/infrastructure/config/app.config';

describe('AppConfig', () => {
  beforeEach(() => {
    resetConfigForTest();
  });

  it('successfully parses valid environment variables with S3 and SMTP defaults', () => {
    const rawEnv = {
      PORT: '4000',
      NODE_ENV: 'test',
      FE_URL: 'http://localhost:3000',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      DIRECT_URL: 'postgresql://user:pass@localhost:5432/db',
    };

    const config = loadConfig(rawEnv);

    expect(config.PORT).toBe(4000);
    expect(config.NODE_ENV).toBe('test');
    expect(config.FE_URL).toBe('http://localhost:3000');
    expect(config.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
    expect(config.DIRECT_URL).toBe('postgresql://user:pass@localhost:5432/db');

    // S3 defaults
    expect(config.S3_ENDPOINT).toBe('http://localhost:9000');
    expect(config.S3_REGION).toBe('us-east-1');
    expect(config.S3_ACCESS_KEY_ID).toBe('minioadmin');
    expect(config.S3_SECRET_ACCESS_KEY).toBe('minioadmin');
    expect(config.S3_BUCKET_AVATARS).toBe('avatars');
    expect(config.S3_PUBLIC_BASE_URL).toBe('http://localhost:9000/avatars');

    // SMTP defaults
    expect(config.SMTP_HOST).toBe('localhost');
    expect(config.SMTP_PORT).toBe(1025);
    expect(config.SMTP_SECURE).toBe(false);
    expect(config.SMTP_USER).toBe('');
    expect(config.SMTP_PASS).toBe('');
    expect(config.MAIL_FROM).toBe('CuteTeachy <no-reply@cuteteachy.local>');
    expect(config.EMAIL_VERIFICATION_REQUIRED).toBe(false);
  });

  it('successfully parses custom S3 variables for Cloudflare R2 production', () => {
    const rawEnv = {
      PORT: '4000',
      NODE_ENV: 'production',
      FE_URL: 'https://cuteteachy.app',
      DATABASE_URL: 'postgresql://user:pass@supabase:6543/db?pgbouncer=true',
      DIRECT_URL: 'postgresql://user:pass@supabase:5432/db',
      S3_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com',
      S3_REGION: 'auto',
      S3_ACCESS_KEY_ID: 'r2-token-id',
      S3_SECRET_ACCESS_KEY: 'r2-secret-key',
      S3_BUCKET: 'prod-avatars',
      S3_PUBLIC_URL_PREFIX: 'https://avatar.cuteteachy.app',
    };

    const config = loadConfig(rawEnv);

    expect(config.S3_ENDPOINT).toBe('https://account-id.r2.cloudflarestorage.com');
    expect(config.S3_REGION).toBe('auto');
    expect(config.S3_ACCESS_KEY_ID).toBe('r2-token-id');
    expect(config.S3_SECRET_ACCESS_KEY).toBe('r2-secret-key');
    expect(config.S3_BUCKET).toBe('prod-avatars');
    expect(config.S3_PUBLIC_URL_PREFIX).toBe('https://avatar.cuteteachy.app');
  });

  it('successfully parses custom SMTP variables for production Gmail SMTP', () => {
    const rawEnv = {
      PORT: '4000',
      NODE_ENV: 'production',
      FE_URL: 'https://cuteteachy.app',
      DATABASE_URL: 'postgresql://user:pass@supabase:6543/db?pgbouncer=true',
      DIRECT_URL: 'postgresql://user:pass@supabase:5432/db',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'noreply@cuteteachy.com',
      SMTP_PASS: 'secret-app-password',
      MAIL_FROM: 'CuteTeachy <noreply@cuteteachy.com>',
      EMAIL_VERIFICATION_REQUIRED: 'true',
    };

    const config = loadConfig(rawEnv);

    expect(config.SMTP_HOST).toBe('smtp.gmail.com');
    expect(config.SMTP_PORT).toBe(465);
    expect(config.SMTP_SECURE).toBe(true);
    expect(config.SMTP_USER).toBe('noreply@cuteteachy.com');
    expect(config.SMTP_PASS).toBe('secret-app-password');
    expect(config.MAIL_FROM).toBe('CuteTeachy <noreply@cuteteachy.com>');
    expect(config.EMAIL_VERIFICATION_REQUIRED).toBe(true);
  });

  it('fails fast and reports missing required variables when required env vars are missing', () => {
    const rawEnv = {
      PORT: '4000',
      // Missing FE_URL, DATABASE_URL, DIRECT_URL
    };

    expect(() => loadConfig(rawEnv)).toThrowError(
      /Environment configuration validation failed:[\s\S]*FE_URL[\s\S]*DATABASE_URL[\s\S]*DIRECT_URL/,
    );
  });
});
