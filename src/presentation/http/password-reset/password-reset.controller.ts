import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { ForgotPasswordUseCase } from '../../../application/password-reset/forgot-password.use-case';
import { ResetPasswordUseCase } from '../../../application/password-reset/reset-password.use-case';
import { Public } from '../auth/public.decorator';
import {
  ForgotPasswordRequestDto,
  ResetPasswordRequestDto,
} from './password-reset.dto';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

@Controller('auth/password')
export class PasswordResetController {
  constructor(
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  @Public()
  @Post('forgot')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgot(
    @Body() dto: ForgotPasswordRequestDto,
    @Req() req: Request,
  ): Promise<void> {
    const ip = getClientIp(req);
    const acceptLanguage = req.headers['accept-language'];
    await this.forgotPasswordUseCase.execute({
      email: dto.email,
      ip,
      acceptLanguage,
    });
  }

  @Public()
  @Post('reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reset(
    @Body() dto: ResetPasswordRequestDto,
    @Req() req: Request,
  ): Promise<void> {
    const ip = getClientIp(req);
    await this.resetPasswordUseCase.execute({
      email: dto.email,
      code: dto.code,
      newPassword: dto.newPassword,
      ip,
    });
  }
}
