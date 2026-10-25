import { PasswordResetController } from '../../../src/presentation/http/password-reset/password-reset.controller';
import { ForgotPasswordUseCase } from '../../../src/application/password-reset/forgot-password.use-case';
import { ResetPasswordUseCase } from '../../../src/application/password-reset/reset-password.use-case';
import { Request } from 'express';

describe('PasswordResetController', () => {
  let controller: PasswordResetController;
  let mockForgotPasswordUseCase: jest.Mocked<Partial<ForgotPasswordUseCase>>;
  let mockResetPasswordUseCase: jest.Mocked<Partial<ResetPasswordUseCase>>;

  beforeEach(() => {
    mockForgotPasswordUseCase = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    mockResetPasswordUseCase = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    controller = new PasswordResetController(
      mockForgotPasswordUseCase as unknown as ForgotPasswordUseCase,
      mockResetPasswordUseCase as unknown as ResetPasswordUseCase,
    );
  });

  it('forgot delegates to ForgotPasswordUseCase with extracted IP and Accept-Language', async () => {
    const req = {
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'accept-language': 'vi-VN,vi;q=0.9',
      },
    } as unknown as Request;

    await controller.forgot({ email: 'teacher@cute.com' }, req);

    expect(mockForgotPasswordUseCase.execute).toHaveBeenCalledWith({
      email: 'teacher@cute.com',
      ip: '192.168.1.1',
      acceptLanguage: 'vi-VN,vi;q=0.9',
    });
  });

  it('reset delegates to ResetPasswordUseCase with extracted IP and body', async () => {
    const req = {
      headers: { 'x-forwarded-for': '192.168.1.1' },
      ip: '127.0.0.1',
    } as unknown as Request;

    await controller.reset(
      {
        email: 'teacher@cute.com',
        code: '123456',
        newPassword: 'newPassword123',
      },
      req,
    );

    expect(mockResetPasswordUseCase.execute).toHaveBeenCalledWith({
      email: 'teacher@cute.com',
      code: '123456',
      newPassword: 'newPassword123',
      ip: '192.168.1.1',
    });
  });
});
