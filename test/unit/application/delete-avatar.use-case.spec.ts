import { DeleteAvatarUseCase } from '../../../src/application/avatar/delete-avatar.use-case';
import { InMemoryAccountRepository } from '../../fakes/in-memory-account.repository';
import { InMemoryAvatarRepository } from '../../fakes/in-memory-avatar.repository';
import { FakeObjectStorage } from '../../fakes/fake-object-storage';
import { Account } from '../../../src/domain/account/account.entity';
import { Email } from '../../../src/domain/account/email.vo';
import { Profile } from '../../../src/domain/account/profile.entity';
import { UnauthorizedError } from '../../../src/domain/account/account.errors';

describe('DeleteAvatarUseCase', () => {
  let accountRepo: InMemoryAccountRepository;
  let avatarRepo: InMemoryAvatarRepository;
  let storage: FakeObjectStorage;
  let useCase: DeleteAvatarUseCase;

  const defaultBucket = 'avatars';

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    avatarRepo = new InMemoryAvatarRepository(accountRepo);
    storage = new FakeObjectStorage('http://localhost:9000/avatars');
    useCase = new DeleteAvatarUseCase(accountRepo, avatarRepo, storage, defaultBucket);
  });

  async function createTestAccount(
    id: string,
    options?: { avatarUrl?: string; avatarKey?: string },
  ): Promise<Account> {
    const email = Email.create(`user-${id}@example.com`);
    const profile = Profile.reconstitute({
      id: `profile-${id}`,
      accountId: id,
      fullName: 'Teacher Name',
      displayName: 'Teacher',
      gender: 'female',
      avatarUrl: options?.avatarUrl,
      avatarKey: options?.avatarKey,
      onboardingCompletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const account = Account.reconstitute({
      id,
      email: email.value,
      emailVerifiedAt: new Date(),
      loginProviders: ['password'],
      profile,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await accountRepo.createWithPassword(account, 'hash');
    return account;
  }

  it('throws UnauthorizedError when account does not exist', async () => {
    await expect(useCase.execute({ accountId: 'non-existing' })).rejects.toThrow(UnauthorizedError);
  });

  it('deletes managed avatar from storage and sets avatarUrl to null in DB', async () => {
    const key = 'system-managed-key.jpg';
    const url = `http://localhost:9000/avatars/${key}`;
    await createTestAccount('acc-1', { avatarUrl: url, avatarKey: key });

    await storage.putObject({
      bucket: defaultBucket,
      key,
      body: Buffer.from('fake image content'),
      contentType: 'image/jpeg',
    });

    const user = await useCase.execute({ accountId: 'acc-1' });

    expect(storage.deleteCalls).toHaveLength(1);
    expect(storage.deleteCalls[0]).toEqual({ bucket: defaultBucket, key });
    expect(storage.hasObject(defaultBucket, key)).toBe(false);

    expect(user.avatarUrl).toBeUndefined();

    const updatedAccount = await accountRepo.findById('acc-1');
    expect(updatedAccount?.profile.avatarUrl).toBeUndefined();
    expect(updatedAccount?.profile.avatarKey).toBeUndefined();
  });

  it('does NOT call delete on storage when avatar was external (Google URL)', async () => {
    const externalUrl = 'https://lh3.googleusercontent.com/a/google-avatar';
    await createTestAccount('acc-google', { avatarUrl: externalUrl, avatarKey: undefined });

    const user = await useCase.execute({ accountId: 'acc-google' });

    expect(storage.deleteCalls).toHaveLength(0);
    expect(user.avatarUrl).toBeUndefined();

    const updatedAccount = await accountRepo.findById('acc-google');
    expect(updatedAccount?.profile.avatarUrl).toBeUndefined();
  });

  it('succeeds without error when user has no avatar at all', async () => {
    await createTestAccount('acc-no-avatar');

    const user = await useCase.execute({ accountId: 'acc-no-avatar' });

    expect(storage.deleteCalls).toHaveLength(0);
    expect(user.avatarUrl).toBeUndefined();
  });
});
