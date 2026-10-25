import { SmtpMailer } from '../../../src/infrastructure/email/smtp-mailer';
import { AppConfig } from '../../../src/infrastructure/config/app.config';
import type { Transporter } from 'nodemailer';

describe('SmtpMailer', () => {
  const baseConfig: AppConfig = {
    PORT: 4000,
    NODE_ENV: 'test',
    FE_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://db',
    DIRECT_URL: 'postgresql://db',
    JWT_SECRET: 'secret',
    JWT_EXPIRES_IN: '15m',
    REFRESH_TOKEN_TTL_REMEMBER: '30d',
    REFRESH_TOKEN_TTL_SESSION: '1d',
    EMAIL_VERIFICATION_REQUIRED: false,
    CRON_SECRET: 'cron',
    S3_ENDPOINT: 'http://minio:9000',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: 'minio',
    S3_SECRET_ACCESS_KEY: 'minio',
    S3_BUCKET_AVATARS: 'avatars',
    S3_PUBLIC_BASE_URL: 'http://minio:9000/avatars',
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_SECURE: false,
    SMTP_USER: '',
    SMTP_PASS: '',
    MAIL_FROM: 'CuteTeachy <no-reply@cuteteachy.local>',
  };

  it('sends email using injected transporter and configured sender', async () => {
    const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'msg-123' });
    const mockTransporter = {
      sendMail: mockSendMail,
    } as unknown as Transporter;

    const mailer = new SmtpMailer(baseConfig);
    (mailer as any).transporter = mockTransporter;

    await mailer.sendEmail(
      'teacher@cuteteachy.local',
      'Test Subject',
      '<p>Test HTML</p>',
      'Test Plaintext',
    );

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'CuteTeachy <no-reply@cuteteachy.local>',
      to: 'teacher@cuteteachy.local',
      subject: 'Test Subject',
      html: '<p>Test HTML</p>',
      text: 'Test Plaintext',
    });
  });

  it('throws when transporter fails to send email', async () => {
    const mockSendMail = jest.fn().mockRejectedValue(new Error('SMTP connection refused'));
    const mockTransporter = {
      sendMail: mockSendMail,
    } as unknown as Transporter;

    const mailer = new SmtpMailer(baseConfig);
    (mailer as any).transporter = mockTransporter;

    await expect(
      mailer.sendEmail('teacher@cuteteachy.local', 'Fail Subject', '<p>Fail</p>'),
    ).rejects.toThrow('SMTP connection refused');
  });
});
