import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OnboardingGuard } from '../../../src/presentation/http/auth/onboarding.guard';
import { GetMeUseCase } from '../../../src/application/account/get-me.use-case';
import { IS_EXEMPT_ONBOARDING_KEY } from '../../../src/presentation/http/auth/exempt-onboarding.decorator';
import { IS_PUBLIC_KEY } from '../../../src/presentation/http/auth/public.decorator';
import { InMemoryAccountRepository } from '../../fakes/in-memory-account.repository';
import { Account } from '../../../src/domain/account/account.entity';
import { Email } from '../../../src/domain/account/email.vo';
import {
  OnboardingRequiredError,
  UnauthorizedError,
} from '../../../src/domain/account/account.errors';

function createMockContext(options: {
  url?: string;
  path?: string;
  user?: { sub: string };
  isPublic?: boolean;
  isExempt?: boolean;
}): { context: ExecutionContext; reflector: jest.Mocked<Reflector> } {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === IS_PUBLIC_KEY) return options.isPublic ?? false;
      if (key === IS_EXEMPT_ONBOARDING_KEY) return options.isExempt ?? false;
      return false;
    }),
  } as unknown as jest.Mocked<Reflector>;

  const req = {
    url: options.url ?? options.path ?? '/tasks',
    path: options.path ?? options.url ?? '/tasks',
    user: options.user,
  };

  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;

  return { context, reflector };
}

describe('OnboardingGuard', () => {
  let accountRepo: InMemoryAccountRepository;
  let getMeUseCase: GetMeUseCase;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    getMeUseCase = new GetMeUseCase(accountRepo);
  });

  it('allows request when route has @Public() metadata', async () => {
    const { context, reflector } = createMockContext({
      isPublic: true,
      path: '/health',
    });
    const guard = new OnboardingGuard(reflector, getMeUseCase);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('allows request when route has @ExemptOnboarding() metadata', async () => {
    const { context, reflector } = createMockContext({
      isExempt: true,
      path: '/exempt-route',
      user: { sub: 'acc-uncompleted' },
    });
    const guard = new OnboardingGuard(reflector, getMeUseCase);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('allows request when route is under /auth/* path without checking onboarding', async () => {
    const { context, reflector } = createMockContext({
      path: '/auth/me',
      user: { sub: 'acc-uncompleted' },
    });
    const guard = new OnboardingGuard(reflector, getMeUseCase);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('throws UnauthorizedError when user is missing from request on protected route', async () => {
    const { context, reflector } = createMockContext({
      path: '/tasks',
    });
    const guard = new OnboardingGuard(reflector, getMeUseCase);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when account does not exist in repository', async () => {
    const { context, reflector } = createMockContext({
      path: '/tasks',
      user: { sub: 'non-existent' },
    });
    const guard = new OnboardingGuard(reflector, getMeUseCase);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
  });

  it('throws OnboardingRequiredError with code onboarding_required when user has not completed onboarding', async () => {
    const account = Account.registerWithPassword({
      id: 'acc-1',
      email: Email.create('teacher@example.com'),
      profileId: 'prof-1',
    });
    await accountRepo.createWithPassword(account, 'hash');

    const { context, reflector } = createMockContext({
      path: '/tasks',
      user: { sub: 'acc-1' },
    });
    const guard = new OnboardingGuard(reflector, getMeUseCase);

    await expect(guard.canActivate(context)).rejects.toThrow(OnboardingRequiredError);
    try {
      await guard.canActivate(context);
    } catch (err: any) {
      expect(err.code).toBe('onboarding_required');
    }
  });

  it('allows request when user has completed onboarding', async () => {
    const account = Account.registerWithPassword({
      id: 'acc-2',
      email: Email.create('teacher2@example.com'),
      profileId: 'prof-2',
    });
    account.profile.update({
      fullName: 'Trần Đức Linh',
      displayName: 'Linh',
      gender: 'male',
    });
    await accountRepo.createWithPassword(account, 'hash');

    const { context, reflector } = createMockContext({
      path: '/tasks',
      user: { sub: 'acc-2' },
    });
    const guard = new OnboardingGuard(reflector, getMeUseCase);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
