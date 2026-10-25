import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { RegisterUseCase } from '../../../application/account/register.use-case';
import { LoginUseCase } from '../../../application/account/login.use-case';
import { RefreshTokenUseCase } from '../../../application/account/refresh-token.use-case';
import { LogoutUseCase } from '../../../application/account/logout.use-case';
import { GetMeUseCase } from '../../../application/account/get-me.use-case';
import { UpdateProfileUseCase } from '../../../application/account/update-profile.use-case';
import { AuthSessionDto, UserDto } from '../../../application/account/account.dto';
import { AccessTokenPayload } from '../../../application/account/ports/token.service.port';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  LoginRequestDto,
  LogoutRequestDto,
  RefreshTokenRequestDto,
  RegisterRequestDto,
  UpdateProfileRequestDto,
} from './auth.dto';

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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterRequestDto, @Req() req: Request): Promise<AuthSessionDto> {
    const ip = getClientIp(req);
    return this.registerUseCase.execute({
      email: dto.email,
      password: dto.password,
      remember: dto.remember,
      ip,
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginRequestDto, @Req() req: Request): Promise<AuthSessionDto> {
    const ip = getClientIp(req);
    return this.loginUseCase.execute({
      email: dto.email,
      password: dto.password,
      remember: dto.remember,
      ip,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenRequestDto, @Req() req: Request): Promise<AuthSessionDto> {
    const ip = getClientIp(req);
    return this.refreshTokenUseCase.execute({
      refreshToken: dto.refreshToken,
      ip,
    });
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: LogoutRequestDto): Promise<void> {
    await this.logoutUseCase.execute({
      refreshToken: dto.refreshToken,
    });
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: AccessTokenPayload): Promise<UserDto> {
    return this.getMeUseCase.execute({
      accountId: user.sub,
    });
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateProfileRequestDto,
  ): Promise<UserDto> {
    return this.updateProfileUseCase.execute({
      accountId: user.sub,
      fullName: dto.fullName,
      displayName: dto.displayName,
      title: dto.title,
      gender: dto.gender,
    });
  }
}
