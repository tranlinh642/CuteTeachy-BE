import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { VerifyEmailUseCase } from '../../../application/email-verification/verify-email.use-case';
import { ResendVerificationEmailUseCase } from '../../../application/email-verification/resend-verification-email.use-case';
import { AuthSessionDto } from '../../../application/account/account.dto';
import { Public } from '../auth/public.decorator';
import { getClientIp } from '../shared/client-ip.helper';
import {
  ResendVerificationEmailRequestDto,
  VerifyEmailRequestDto,
} from './email-verification.dto';

@Controller('auth/email')
export class EmailVerificationController {
  constructor(
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly resendVerificationEmailUseCase: ResendVerificationEmailUseCase,
  ) {}

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: VerifyEmailRequestDto, @Req() req: Request): Promise<AuthSessionDto> {
    const ip = getClientIp(req);
    return this.verifyEmailUseCase.execute({
      email: dto.email,
      code: dto.code,
      ip,
    });
  }

  @Public()
  @Post('resend')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resend(
    @Body() dto: ResendVerificationEmailRequestDto,
    @Req() req: Request,
  ): Promise<void> {
    const ip = getClientIp(req);
    const acceptLanguage = req.headers['accept-language'];
    await this.resendVerificationEmailUseCase.execute({
      email: dto.email,
      ip,
      acceptLanguage,
    });
  }
}
