import { S3ObjectStorage } from '../../../src/infrastructure/storage/s3-object-storage';
import { AppConfig } from '../../../src/infrastructure/config/env.schema';

describe('S3ObjectStorage', () => {
  const baseConfig: AppConfig = {
    PORT: 4000,
    NODE_ENV: 'test',
    FE_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://db',
    DIRECT_URL: 'postgresql://db',
    JWT_SECRET: 'secret-12345678901234567890123456789012',
    JWT_EXPIRES_IN: '15m',
    REFRESH_TOKEN_TTL_REMEMBER: '30d',
    REFRESH_TOKEN_TTL_SESSION: '1d',
    EMAIL_VERIFICATION_REQUIRED: false,
    CRON_SECRET: 'cron-secret',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: 'minioadmin',
    S3_SECRET_ACCESS_KEY: 'minioadmin',
    S3_BUCKET: 'avatars',
    S3_BUCKET_AVATARS: 'avatars',
    S3_PUBLIC_BASE_URL: 'http://localhost:9000/avatars',
    S3_PUBLIC_URL_PREFIX: undefined,
  };

  it('builds public url using S3_PUBLIC_BASE_URL', () => {
    const storage = new S3ObjectStorage(baseConfig);
    const url = storage.getPublicUrl('avatars', 'user-avatar-123.jpg');
    expect(url).toBe('http://localhost:9000/avatars/user-avatar-123.jpg');
  });

  it('builds public url using S3_PUBLIC_URL_PREFIX for Cloudflare R2', () => {
    const r2Config: AppConfig = {
      ...baseConfig,
      S3_PUBLIC_URL_PREFIX: 'https://avatar.cuteteachy.app',
      S3_PUBLIC_BASE_URL: 'http://localhost:9000/avatars',
    };
    const storage = new S3ObjectStorage(r2Config);
    const url = storage.getPublicUrl('avatars', 'uuid-456.webp');
    expect(url).toBe('https://avatar.cuteteachy.app/uuid-456.webp');
  });

  it('sends PutObjectCommand and DeleteObjectCommand to S3Client', async () => {
    const storage = new S3ObjectStorage(baseConfig);
    const mockSend = jest.fn().mockResolvedValue({});
    (storage as any).client = { send: mockSend };

    const buffer = Buffer.from('image bytes');
    await storage.putObject({
      bucket: 'avatars',
      key: 'test.png',
      body: buffer,
      contentType: 'image/png',
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const putCmd = mockSend.mock.calls[0][0];
    expect(putCmd.input).toEqual({
      Bucket: 'avatars',
      Key: 'test.png',
      Body: buffer,
      ContentType: 'image/png',
    });

    await storage.deleteObject('avatars', 'test.png');
    expect(mockSend).toHaveBeenCalledTimes(2);
    const delCmd = mockSend.mock.calls[1][0];
    expect(delCmd.input).toEqual({
      Bucket: 'avatars',
      Key: 'test.png',
    });
  });
});
