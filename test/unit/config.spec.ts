import { loadConfig, resetConfigForTest } from '../../src/infrastructure/config/app.config';

describe('AppConfig', () => {
  beforeEach(() => {
    resetConfigForTest();
  });

  it('successfully parses valid environment variables', () => {
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
