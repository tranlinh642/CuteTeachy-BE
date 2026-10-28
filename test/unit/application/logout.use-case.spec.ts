import { LogoutUseCase } from '../../../src/application/account/logout.use-case';
import { InMemoryRefreshTokenRepository } from '../../fakes/in-memory-refresh-token.repository';
import { FakeTokenService } from '../../fakes/fake-token.service';
import { FixedClock } from '../../fakes/fixed-clock';

describe('LogoutUseCase', () => {
  let refreshTokenRepo: InMemoryRefreshTokenRepository;
  let tokenService: FakeTokenService;
  let clock: FixedClock;
  let useCase: LogoutUseCase;

  const now = new Date('2026-10-25T10:00:00.000Z');

  beforeEach(() => {
    refreshTokenRepo = new InMemoryRefreshTokenRepository();
    tokenService = new FakeTokenService();
    clock = new FixedClock(now);
    useCase = new LogoutUseCase(refreshTokenRepo, tokenService, clock);
  });

  it('revokes the provided refresh token', async () => {
    const rawToken = 'my_refresh_token';
    const hash = tokenService.hashRefreshToken(rawToken);

    await refreshTokenRepo.save({
      id: 'tok-1',
      accountId: 'acc-1',
      tokenHash: hash,
      familyId: 'family-1',
      expiresAt: new Date(now.getTime() + 86400000),
    });

    await useCase.execute({ refreshToken: rawToken });

    const record = await refreshTokenRepo.findByTokenHash(hash);
    expect(record?.revokedAt).toEqual(now);
  });

  it('completes without error if token does not exist', async () => {
    await expect(
      useCase.execute({ refreshToken: 'non_existent_token' }),
    ).resolves.toBeUndefined();
  });

  it('completes without error if refreshToken is not provided or empty', async () => {
    await expect(useCase.execute({})).resolves.toBeUndefined();
    await expect(useCase.execute({ refreshToken: '' })).resolves.toBeUndefined();
  });
});
