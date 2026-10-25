import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { GetGoogleAuthUrlUseCase } from '../../../application/google-auth/get-google-auth-url.use-case';
import { HandleGoogleCallbackUseCase } from '../../../application/google-auth/handle-google-callback.use-case';
import { ExchangeCodeUseCase } from '../../../application/google-auth/exchange-code.use-case';
import { InvalidExchangeCodeError } from '../../../domain/google-auth/google-auth.errors';
import { AuthSessionDto } from '../../../application/account/account.dto';
import { Public } from '../auth/public.decorator';
import {
  ExchangeRequestDto,
  GoogleAuthQueryDto,
  GoogleCallbackQueryDto,
} from './google-auth.dto';

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

@Controller('auth/google')
export class GoogleAuthController {
  constructor(
    private readonly getGoogleAuthUrlUseCase: GetGoogleAuthUrlUseCase,
    private readonly handleGoogleCallbackUseCase: HandleGoogleCallbackUseCase,
    private readonly exchangeCodeUseCase: ExchangeCodeUseCase,
  ) {}

  @Public()
  @Get()
  async googleAuth(
    @Query() query: GoogleAuthQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const remember = query?.remember === 'true';
    const { url } = await this.getGoogleAuthUrlUseCase.execute({ remember });
    res.redirect(HttpStatus.FOUND, url);
  }

  @Public()
  @Get('callback')
  async googleCallback(
    @Query() query: GoogleCallbackQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.handleGoogleCallbackUseCase.execute({
      code: query?.code,
      state: query?.state,
      error: query?.error,
    });
    res.redirect(HttpStatus.FOUND, result.redirectUrl);
  }

  @Public()
  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  async exchange(
    @Body() dto: ExchangeRequestDto,
    @Req() req: Request,
  ): Promise<AuthSessionDto> {
    const ip = getClientIp(req);
    try {
      return await this.exchangeCodeUseCase.execute({
        code: dto.code,
        ip,
      });
    } catch (error) {
      if (error instanceof InvalidExchangeCodeError) {
        throw new UnauthorizedException({
          code: 'invalid_code',
          message: error.message,
        });
      }
      throw error;
    }
  }
}
