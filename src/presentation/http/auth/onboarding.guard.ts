import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { GetMeUseCase } from '../../../application/account/get-me.use-case';
import { OnboardingRequiredError, UnauthorizedError } from '../../../domain/account/account.errors';
import { IS_PUBLIC_KEY } from './public.decorator';
import { IS_EXEMPT_ONBOARDING_KEY } from './exempt-onboarding.decorator';

const ONBOARDED_CACHE_TTL_MS = 5 * 60 * 1000;
const ONBOARDED_CACHE_MAX_SIZE = 5000;

@Injectable()
export class OnboardingGuard implements CanActivate {
  private readonly onboardedAccounts = new Map<string, number>();

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

    const now = Date.now();
    const cachedExpiresAt = this.onboardedAccounts.get(userId);
    if (cachedExpiresAt !== undefined && cachedExpiresAt > now) {
      return true;
    }

    const user = await this.getMeUseCase.execute({ accountId: userId });
    if (!user.onboardingCompletedAt) {
      throw new OnboardingRequiredError('Onboarding required');
    }

    if (this.onboardedAccounts.size >= ONBOARDED_CACHE_MAX_SIZE) {
      this.onboardedAccounts.clear();
    }
    this.onboardedAccounts.set(userId, now + ONBOARDED_CACHE_TTL_MS);

    return true;
  }
}
