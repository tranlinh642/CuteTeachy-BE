import * as webpush from 'web-push';
import { WebPushSender } from '../../../src/infrastructure/notification/web-push-sender';
import { PushSubscriptionExpiredError } from '../../../src/application/push-subscription/ports/push-sender.port';
import { AppConfig } from '../../../src/infrastructure/config/app.config';

jest.mock('web-push', () => ({
  sendNotification: jest.fn(),
}));

describe('WebPushSender', () => {
  let sender: WebPushSender;
  const mockConfig: AppConfig = {
    PORT: 4000,
    NODE_ENV: 'test',
    FE_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgres://localhost:5432/db',
    DIRECT_URL: 'postgres://localhost:5432/db',
    JWT_SECRET: 'dev-jwt-secret-key-cute-teachy-at-least-32-chars',
    JWT_EXPIRES_IN: '15m',
    REFRESH_TOKEN_TTL_REMEMBER: '30d',
    REFRESH_TOKEN_TTL_SESSION: '1d',
    EMAIL_VERIFICATION_REQUIRED: false,
    CRON_SECRET: 'dev-cron-secret-token',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: 'minioadmin',
    S3_SECRET_ACCESS_KEY: 'minioadmin',
    S3_BUCKET_AVATARS: 'avatars',
    S3_PUBLIC_BASE_URL: 'http://localhost:9000/avatars',
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_SECURE: false,
    SMTP_USER: '',
    SMTP_PASS: '',
    MAIL_FROM: 'CuteTeachy <no-reply@cuteteachy.local>',
    VAPID_PUBLIC_KEY: 'mock-public-key',
    VAPID_PRIVATE_KEY: 'mock-private-key',
    VAPID_SUBJECT: 'mailto:admin@cuteteachy.local',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sender = new WebPushSender(mockConfig);
  });

  it('returns configured VAPID public key', () => {
    expect(sender.getVapidPublicKey()).toBe('mock-public-key');
  });

  it('calls webpush.sendNotification with subscription and serialized payload', async () => {
    (webpush.sendNotification as jest.Mock).mockResolvedValueOnce({ statusCode: 201 });

    const target = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
      keys: {
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      },
    };

    const payload = {
      title: 'Hello',
      body: 'World',
    };

    await sender.send(target, payload);

    expect(webpush.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: target.endpoint,
        keys: target.keys,
      },
      JSON.stringify(payload),
      {
        vapidDetails: {
          subject: mockConfig.VAPID_SUBJECT,
          publicKey: mockConfig.VAPID_PUBLIC_KEY,
          privateKey: mockConfig.VAPID_PRIVATE_KEY,
        },
      },
    );
  });

  it('throws PushSubscriptionExpiredError when webpush returns 410 Gone', async () => {
    const error410 = new Error('Subscription no longer valid') as any;
    error410.statusCode = 410;
    (webpush.sendNotification as jest.Mock).mockRejectedValueOnce(error410);

    const target = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/expired',
      keys: {
        p256dh: 'p256dh',
        auth: 'auth',
      },
    };

    await expect(sender.send(target, { title: 'Test', body: 'Body' })).rejects.toThrow(
      PushSubscriptionExpiredError,
    );
  });

  it('throws PushSubscriptionExpiredError when webpush returns 404 Not Found', async () => {
    const error404 = new Error('Subscription not found') as any;
    error404.statusCode = 404;
    (webpush.sendNotification as jest.Mock).mockRejectedValueOnce(error404);

    const target = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/not-found',
      keys: {
        p256dh: 'p256dh',
        auth: 'auth',
      },
    };

    await expect(sender.send(target, { title: 'Test', body: 'Body' })).rejects.toThrow(
      PushSubscriptionExpiredError,
    );
  });

  it('rethrows standard errors when status is not 404/410', async () => {
    const error500 = new Error('Push service unavailable') as any;
    error500.statusCode = 500;
    (webpush.sendNotification as jest.Mock).mockRejectedValueOnce(error500);

    const target = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/service-error',
      keys: {
        p256dh: 'p256dh',
        auth: 'auth',
      },
    };

    await expect(sender.send(target, { title: 'Test', body: 'Body' })).rejects.toThrow(
      'Push service unavailable',
    );
  });
});
