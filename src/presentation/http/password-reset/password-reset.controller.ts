import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { ForgotPasswordUseCase } from '../../../application/password-reset/forgot-password.use-case';
import { ResetPasswordUseCase } from '../../../application/password-reset/reset-password.use-case';
import { Public } from '../auth/public.decorator';
import { getClientIp } from '../shared/client-ip.helper';
import {
  ForgotPasswordRequestDto,
  ResetPasswordRequestDto,
} from './password-reset.dto';

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
