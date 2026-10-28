import { GetMeUseCase } from '../../../src/application/account/get-me.use-case';
import { InMemoryAccountRepository } from '../../fakes/in-memory-account.repository';
import { Account } from '../../../src/domain/account/account.entity';
import { Email } from '../../../src/domain/account/email.vo';
import { UnauthorizedError } from '../../../src/domain/account/account.errors';

describe('GetMeUseCase', () => {
  let accountRepo: InMemoryAccountRepository;
  let useCase: GetMeUseCase;

  beforeEach(async () => {
    accountRepo = new InMemoryAccountRepository();
    useCase = new GetMeUseCase(accountRepo);

    const account = Account.registerWithPassword({
      id: 'acc-1',
      email: Email.create('teacher@cute.com'),
      profileId: 'prof-1',
    });
    await accountRepo.createWithPassword(account, 'hash');
  });

  it('returns UserDto for valid accountId', async () => {
    const user = await useCase.execute({ accountId: 'acc-1' });

    expect(user.id).toBe('acc-1');
    expect(user.email).toBe('teacher@cute.com');
    expect(user.emailVerified).toBe(false);
    expect(user.fullName).toBe('');
    expect(user.displayName).toBe('');
    expect(user.gender).toBeNull();
    expect(user.onboardingCompletedAt).toBeNull();
  });

  it('throws UnauthorizedError if account is not found', async () => {
    await expect(useCase.execute({ accountId: 'unknown-id' })).rejects.toThrow(
      UnauthorizedError,
    );
  });
});
