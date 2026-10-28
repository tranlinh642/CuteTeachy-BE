import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../../../src/presentation/http/auth/jwt-auth.guard';
import { FakeTokenService } from '../../fakes/fake-token.service';
import { UnauthorizedError } from '../../../src/domain/account/account.errors';

describe('JwtAuthGuard', () => {
  let reflector: Reflector;
  let tokenService: FakeTokenService;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    reflector = new Reflector();
    tokenService = new FakeTokenService();
    guard = new JwtAuthGuard(reflector, tokenService);
  });

  function createMockContext(headers: Record<string, string> = {}, isPublic = false): ExecutionContext {
    const request: any = {
      headers,
    };

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);

    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows access to public routes without token', async () => {
    const context = createMockContext({}, true);
    const canActivate = await guard.canActivate(context);
    expect(canActivate).toBe(true);
  });

  it('allows access with valid Bearer token and attaches user payload to request', async () => {
    const context = createMockContext({
      authorization: 'Bearer access_token_user-456',
    });

    const canActivate = await guard.canActivate(context);
    expect(canActivate).toBe(true);

    const req = context.switchToHttp().getRequest();
    expect(req.user).toEqual({ sub: 'user-456' });
  });

  it('rejects with UnauthorizedError when authorization header is missing', async () => {
    const context = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
  });

  it('rejects with UnauthorizedError when authorization header is malformed', async () => {
    const context = createMockContext({
      authorization: 'Basic dXNlcjpwYXNz',
    });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
  });

  it('rejects with UnauthorizedError when token is invalid', async () => {
    const context = createMockContext({
      authorization: 'Bearer invalid_token',
    });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
  });
});
