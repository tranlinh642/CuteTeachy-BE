import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { GetMeUseCase } from '../../../application/account/get-me.use-case';
import { OnboardingRequiredError, UnauthorizedError } from '../../../domain/account/account.errors';
import { IS_PUBLIC_KEY } from './public.decorator';
import { IS_EXEMPT_ONBOARDING_KEY } from './exempt-onboarding.decorator';

@Injectable()
export class OnboardingGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly getMeUseCase: GetMeUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const isExempt = this.reflector.getAllAndOverride<boolean>(IS_EXEMPT_ONBOARDING_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isExempt) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const rawPath = request.path || request.url || '';
    const path = rawPath.split('?')[0];
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    if (normalizedPath === '/auth' || normalizedPath.startsWith('/auth/')) {
      return true;
    }

    const userId = (request as any).user?.sub;
    if (!userId) {
      throw new UnauthorizedError('Unauthorized');
    }

    const user = await this.getMeUseCase.execute({ accountId: userId });
    if (!user.onboardingCompletedAt) {
      throw new OnboardingRequiredError('Onboarding required');
    }

    return true;
  }
}
