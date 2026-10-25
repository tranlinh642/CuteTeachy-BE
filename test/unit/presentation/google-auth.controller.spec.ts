import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import { Response, Request } from 'express';
import { GoogleAuthController } from '../../../src/presentation/http/google-auth/google-auth.controller';
import { GetGoogleAuthUrlUseCase } from '../../../src/application/google-auth/get-google-auth-url.use-case';
import { HandleGoogleCallbackUseCase } from '../../../src/application/google-auth/handle-google-callback.use-case';
import { ExchangeCodeUseCase } from '../../../src/application/google-auth/exchange-code.use-case';
import { InvalidExchangeCodeError } from '../../../src/domain/google-auth/google-auth.errors';

describe('GoogleAuthController', () => {
  let controller: GoogleAuthController;
  let getGoogleAuthUrlUseCase: jest.Mocked<GetGoogleAuthUrlUseCase>;
  let handleGoogleCallbackUseCase: jest.Mocked<HandleGoogleCallbackUseCase>;
  let exchangeCodeUseCase: jest.Mocked<ExchangeCodeUseCase>;

  let mockResponse: {
    redirect: jest.Mock;
    status: jest.Mock;
    json: jest.Mock;
  };

  let mockRequest: Partial<Request>;

  beforeEach(() => {
    getGoogleAuthUrlUseCase = {
      execute: jest.fn(),
    } as any;
    handleGoogleCallbackUseCase = {
      execute: jest.fn(),
    } as any;
    exchangeCodeUseCase = {
      execute: jest.fn(),
    } as any;

    controller = new GoogleAuthController(
      getGoogleAuthUrlUseCase,
      handleGoogleCallbackUseCase,
      exchangeCodeUseCase,
    );

    mockResponse = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      ip: '127.0.0.1',
      headers: {},
      socket: {} as any,
    };
  });

  describe('googleAuth', () => {
    it('redirects 302 to Google authorization URL with remember=true', async () => {
      getGoogleAuthUrlUseCase.execute.mockResolvedValue({
        url: 'https://accounts.google.com/auth?state=xyz',
      });

      await controller.googleAuth({ remember: 'true' }, mockResponse as any as Response);

      expect(getGoogleAuthUrlUseCase.execute).toHaveBeenCalledWith({ remember: true });
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        HttpStatus.FOUND,
        'https://accounts.google.com/auth?state=xyz',
      );
    });

    it('redirects 302 with remember=false when query param is not true', async () => {
      getGoogleAuthUrlUseCase.execute.mockResolvedValue({
        url: 'https://accounts.google.com/auth?state=abc',
      });

      await controller.googleAuth({ remember: 'false' }, mockResponse as any as Response);

      expect(getGoogleAuthUrlUseCase.execute).toHaveBeenCalledWith({ remember: false });
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        HttpStatus.FOUND,
        'https://accounts.google.com/auth?state=abc',
      );
    });
  });

  describe('googleCallback', () => {
    it('redirects 302 to FE callback URL returned by use case', async () => {
      handleGoogleCallbackUseCase.execute.mockResolvedValue({
        redirectUrl: 'http://localhost:3000/auth/callback?code=mock-code',
      });

      await controller.googleCallback(
        { code: 'google-code', state: 'google-state' },
        mockResponse as any as Response,
      );

      expect(handleGoogleCallbackUseCase.execute).toHaveBeenCalledWith({
        code: 'google-code',
        state: 'google-state',
        error: undefined,
      });
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        HttpStatus.FOUND,
        'http://localhost:3000/auth/callback?code=mock-code',
      );
    });
  });

  describe('exchange', () => {
    it('calls use case with code and client IP, returning session', async () => {
      const mockSession = {
        user: { id: 'u1' } as any,
        accessToken: 'acc',
        expiresAt: '2026-10-25T12:00:00Z',
        refreshToken: 'ref',
        refreshExpiresAt: '2026-11-25T12:00:00Z',
      };
      exchangeCodeUseCase.execute.mockResolvedValue(mockSession);

      const result = await controller.exchange({ code: 'my-code' }, mockRequest as Request);

      expect(exchangeCodeUseCase.execute).toHaveBeenCalledWith({
        code: 'my-code',
        ip: '127.0.0.1',
      });
      expect(result).toBe(mockSession);
    });

    it('extracts IP from x-forwarded-for header when present', async () => {
      mockRequest.headers = { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' };
      exchangeCodeUseCase.execute.mockResolvedValue({} as any);

      await controller.exchange({ code: 'my-code' }, mockRequest as Request);

      expect(exchangeCodeUseCase.execute).toHaveBeenCalledWith({
        code: 'my-code',
        ip: '203.0.113.195',
      });
    });

    it('maps InvalidExchangeCodeError to UnauthorizedException', async () => {
      exchangeCodeUseCase.execute.mockRejectedValue(
        new InvalidExchangeCodeError('Invalid exchange code'),
      );

      await expect(
        controller.exchange({ code: 'bad-code' }, mockRequest as Request),
      ).rejects.toThrow(UnauthorizedException);

      try {
        await controller.exchange({ code: 'bad-code' }, mockRequest as Request);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect(err.getResponse()).toEqual({
          code: 'invalid_code',
          message: 'Invalid exchange code',
        });
      }
    });
  });
});
