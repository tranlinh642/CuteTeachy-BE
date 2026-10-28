import { UploadAvatarUseCase } from '../../../src/application/avatar/upload-avatar.use-case';
import { InMemoryAccountRepository } from '../../fakes/in-memory-account.repository';
import { InMemoryAvatarRepository } from '../../fakes/in-memory-avatar.repository';
import { FakeObjectStorage } from '../../fakes/fake-object-storage';
import { SequentialIdGenerator } from '../../fakes/sequential-id-generator';
import { Account } from '../../../src/domain/account/account.entity';
import { Email } from '../../../src/domain/account/email.vo';
import { Profile } from '../../../src/domain/account/profile.entity';
import {
  FileTooLargeError,
  UnsupportedFileTypeError,
} from '../../../src/domain/avatar/avatar.errors';
import { UnauthorizedError } from '../../../src/domain/account/account.errors';

describe('UploadAvatarUseCase', () => {
  let accountRepo: InMemoryAccountRepository;
  let avatarRepo: InMemoryAvatarRepository;
  let storage: FakeObjectStorage;
  let idGen: SequentialIdGenerator;
  let useCase: UploadAvatarUseCase;

  const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  const validWebp = Buffer.concat([
    Buffer.from([0x52, 0x49, 0x46, 0x46]),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from([0x57, 0x45, 0x42, 0x50]),
    Buffer.from([0x56, 0x50, 0x38, 0x20]),
  ]);

  const defaultBucket = 'avatars';

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    avatarRepo = new InMemoryAvatarRepository(accountRepo);
    storage = new FakeObjectStorage('http://localhost:9000/avatars');
    idGen = new SequentialIdGenerator();
    useCase = new UploadAvatarUseCase(accountRepo, avatarRepo, storage, idGen, defaultBucket);
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

  it('rejects file larger than 2 MB with FileTooLargeError', async () => {
    await createTestAccount('acc-1');

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        file: {
          buffer: validJpeg,
          size: 2 * 1024 * 1024 + 1,
        },
      }),
    ).rejects.toThrow(FileTooLargeError);

    expect(storage.putCalls).toHaveLength(0);
  });

  it('rejects invalid file type with UnsupportedFileTypeError', async () => {
    await createTestAccount('acc-1');

    const fakePdf = Buffer.from('%PDF-1.5 test content');
    await expect(
      useCase.execute({
        accountId: 'acc-1',
        file: {
          buffer: fakePdf,
          size: fakePdf.length,
        },
      }),
    ).rejects.toThrow(UnsupportedFileTypeError);

    expect(storage.putCalls).toHaveLength(0);
  });

  it('throws UnauthorizedError when account does not exist', async () => {
    await expect(
      useCase.execute({
        accountId: 'non-existing-acc',
        file: {
          buffer: validJpeg,
          size: validJpeg.length,
        },
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('uploads valid JPEG, saves object in storage, and updates user profile', async () => {
    await createTestAccount('acc-1');

    const user = await useCase.execute({
      accountId: 'acc-1',
      file: {
        buffer: validJpeg,
        size: validJpeg.length,
      },
    });

    expect(storage.putCalls).toHaveLength(1);
    const putCall = storage.putCalls[0];
    expect(putCall.bucket).toBe('avatars');
    expect(putCall.key).toMatch(/\.jpg$/);
    expect(putCall.contentType).toBe('image/jpeg');
    expect(putCall.body).toEqual(validJpeg);

    expect(user.avatarUrl).toBe(`http://localhost:9000/avatars/${putCall.key}`);

    const updatedAccount = await accountRepo.findById('acc-1');
    expect(updatedAccount?.profile.avatarUrl).toBe(user.avatarUrl);
    expect(updatedAccount?.profile.avatarKey).toBe(putCall.key);
  });

  it('uploads PNG and WebP files with appropriate extension and content type', async () => {
    await createTestAccount('acc-png');
    const userPng = await useCase.execute({
      accountId: 'acc-png',
      file: { buffer: validPng, size: validPng.length },
    });
    expect(storage.putCalls[0].contentType).toBe('image/png');
    expect(userPng.avatarUrl).toMatch(/\.png$/);

    await createTestAccount('acc-webp');
    const userWebp = await useCase.execute({
      accountId: 'acc-webp',
      file: { buffer: validWebp, size: validWebp.length },
    });
    expect(storage.putCalls[1].contentType).toBe('image/webp');
    expect(userWebp.avatarUrl).toMatch(/\.webp$/);
  });

  it('deletes old managed avatar from storage when user replaces avatar', async () => {
    const oldKey = 'old-avatar-uuid.png';
    const oldUrl = `http://localhost:9000/avatars/${oldKey}`;
    await createTestAccount('acc-1', { avatarUrl: oldUrl, avatarKey: oldKey });

    // Seed old object in storage
    await storage.putObject({
      bucket: defaultBucket,
      key: oldKey,
      body: validPng,
      contentType: 'image/png',
    });
    expect(storage.hasObject(defaultBucket, oldKey)).toBe(true);

    const user = await useCase.execute({
      accountId: 'acc-1',
      file: { buffer: validJpeg, size: validJpeg.length },
    });

    // Old object deleted from storage
    expect(storage.deleteCalls).toHaveLength(1);
    expect(storage.deleteCalls[0]).toEqual({ bucket: defaultBucket, key: oldKey });
    expect(storage.hasObject(defaultBucket, oldKey)).toBe(false);

    // New avatar saved
    expect(user.avatarUrl).not.toBe(oldUrl);
  });

  it('does NOT delete anything from storage if old avatar was external (e.g. Google avatar URL)', async () => {
    const googleAvatarUrl = 'https://lh3.googleusercontent.com/a/random-google-photo';
    // User has avatarUrl from Google but NO avatarKey
    await createTestAccount('acc-google', { avatarUrl: googleAvatarUrl, avatarKey: undefined });

    const user = await useCase.execute({
      accountId: 'acc-google',
      file: { buffer: validJpeg, size: validJpeg.length },
    });

    expect(storage.deleteCalls).toHaveLength(0);
    expect(user.avatarUrl).toMatch(/^http:\/\/localhost:9000\/avatars\//);
  });
});
