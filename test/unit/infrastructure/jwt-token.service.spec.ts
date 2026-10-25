import { JwtTokenService } from '../../../src/infrastructure/auth/jwt-token.service';
import { AppConfig } from '../../../src/infrastructure/config/app.config';
import { UnauthorizedError } from '../../../src/domain/account/account.errors';

describe('JwtTokenService', () => {
  const mockConfig: AppConfig = {
    PORT: 4000,
    NODE_ENV: 'test',
    FE_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://test',
    DIRECT_URL: 'postgresql://test',
    JWT_SECRET: 'test-secret-at-least-32-characters-long',
    JWT_EXPIRES_IN: '15m',
    REFRESH_TOKEN_TTL_REMEMBER: '30d',
    REFRESH_TOKEN_TTL_SESSION: '1d',
    EMAIL_VERIFICATION_REQUIRED: false,
    CRON_SECRET: 'cron-secret',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: 'minioadmin',
    S3_SECRET_ACCESS_KEY: 'minioadmin',
    S3_BUCKET_AVATARS: 'avatars',
    S3_PUBLIC_BASE_URL: 'http://localhost:9000/avatars',
  };

  const service = new JwtTokenService(mockConfig);

  it('generates and verifies access token', async () => {
    const { token, expiresAt } = await service.createAccessToken({ sub: 'user-123' });

    expect(token).toBeDefined();
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const payload = await service.verifyAccessToken(token);
    expect(payload.sub).toBe('user-123');
  });

  it('throws UnauthorizedError when verifying invalid token', async () => {
    await expect(service.verifyAccessToken('invalid.token.here')).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('generates refresh token with appropriate TTL based on remember flag', async () => {
    const sessionToken = await service.createRefreshToken(false);
    const rememberToken = await service.createRefreshToken(true);

    const now = Date.now();
    const sessionDiffHours = (sessionToken.expiresAt.getTime() - now) / (1000 * 3600);
    const rememberDiffDays = (rememberToken.expiresAt.getTime() - now) / (1000 * 3600 * 24);

    expect(Math.round(sessionDiffHours)).toBe(24);
    expect(Math.round(rememberDiffDays)).toBe(30);

    expect(sessionToken.token).not.toBe(sessionToken.tokenHash);
    expect(service.hashRefreshToken(sessionToken.token)).toBe(sessionToken.tokenHash);
  });
});
