import { EmailVerificationController } from '../../../src/presentation/http/email-verification/email-verification.controller';
import { VerifyEmailUseCase } from '../../../src/application/email-verification/verify-email.use-case';
import { ResendVerificationEmailUseCase } from '../../../src/application/email-verification/resend-verification-email.use-case';
import { Request } from 'express';

describe('EmailVerificationController', () => {
  let controller: EmailVerificationController;
  let mockVerifyEmailUseCase: jest.Mocked<Partial<VerifyEmailUseCase>>;
  let mockResendVerificationEmailUseCase: jest.Mocked<Partial<ResendVerificationEmailUseCase>>;

  beforeEach(() => {
    mockVerifyEmailUseCase = {
      execute: jest.fn().mockResolvedValue({
        user: { id: 'acc-1', email: 'teacher@cute.com', emailVerified: true },
        accessToken: 'mock-access',
        refreshToken: 'mock-refresh',
      } as any),
    };

    mockResendVerificationEmailUseCase = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    controller = new EmailVerificationController(
      mockVerifyEmailUseCase as unknown as VerifyEmailUseCase,
      mockResendVerificationEmailUseCase as unknown as ResendVerificationEmailUseCase,
    );
  });

  it('verify delegates to VerifyEmailUseCase with extracted IP and body', async () => {
    const req = {
      headers: { 'x-forwarded-for': '192.168.1.1' },
      ip: '127.0.0.1',
    } as unknown as Request;

    const result = await controller.verify(
      { email: 'teacher@cute.com', code: '123456' },
      req,
    );

    expect(mockVerifyEmailUseCase.execute).toHaveBeenCalledWith({
      email: 'teacher@cute.com',
      code: '123456',
      ip: '192.168.1.1',
    });
    expect(result.accessToken).toBe('mock-access');
  });

  it('resend delegates to ResendVerificationEmailUseCase with Accept-Language header', async () => {
    const req = {
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'accept-language': 'vi-VN,vi;q=0.9',
      },
    } as unknown as Request;

    await controller.resend({ email: 'teacher@cute.com' }, req);

    expect(mockResendVerificationEmailUseCase.execute).toHaveBeenCalledWith({
      email: 'teacher@cute.com',
      ip: '192.168.1.1',
      acceptLanguage: 'vi-VN,vi;q=0.9',
    });
  });
});
