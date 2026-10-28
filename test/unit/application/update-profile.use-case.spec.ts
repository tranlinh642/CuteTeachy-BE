import { UpdateProfileUseCase } from '../../../src/application/account/update-profile.use-case';
import { InMemoryAccountRepository } from '../../fakes/in-memory-account.repository';
import { FixedClock } from '../../fakes/fixed-clock';
import { Account } from '../../../src/domain/account/account.entity';
import { Email } from '../../../src/domain/account/email.vo';
import { UnauthorizedError } from '../../../src/domain/account/account.errors';

describe('UpdateProfileUseCase', () => {
  let accountRepo: InMemoryAccountRepository;
  let clock: FixedClock;
  let useCase: UpdateProfileUseCase;

  const now = new Date('2026-10-25T11:00:00.000Z');

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    clock = new FixedClock(now);
    useCase = new UpdateProfileUseCase(accountRepo, clock);
  });

  it('throws UnauthorizedError if account does not exist', async () => {
    await expect(
      useCase.execute({
        accountId: 'non-existent',
        fullName: 'Trần Đức Linh',
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('partially updates profile and keeps onboardingCompletedAt null when required fields are incomplete', async () => {
    const account = Account.registerWithPassword({
      id: 'acc-1',
      email: Email.create('teacher@example.com'),
      profileId: 'prof-1',
      now: new Date('2026-10-25T10:00:00.000Z'),
    });
    await accountRepo.createWithPassword(account, 'hash');

    const result = await useCase.execute({
      accountId: 'acc-1',
      fullName: '  Trần Đức Linh  ',
      displayName: '  Linh  ',
    });

    expect(result.id).toBe('acc-1');
    expect(result.fullName).toBe('Trần Đức Linh');
    expect(result.displayName).toBe('Linh');
    expect(result.gender).toBeNull();
    expect(result.onboardingCompletedAt).toBeNull();

    // Verify persistence in repository
    const stored = await accountRepo.findById('acc-1');
    expect(stored?.profile.fullName).toBe('Trần Đức Linh');
    expect(stored?.profile.displayName).toBe('Linh');
    expect(stored?.profile.onboardingCompletedAt).toBeNull();
  });

  it('marks onboarding complete and sets onboardingCompletedAt when all required fields are provided', async () => {
    const account = Account.registerWithPassword({
      id: 'acc-2',
      email: Email.create('teacher2@example.com'),
      profileId: 'prof-2',
      now: new Date('2026-10-25T10:00:00.000Z'),
    });
    await accountRepo.createWithPassword(account, 'hash');

    const result = await useCase.execute({
      accountId: 'acc-2',
      fullName: 'Nguyễn Thị Hoa',
      displayName: 'Hoa',
      title: 'Cô giáo Mầm non',
      gender: 'female',
    });

    expect(result.fullName).toBe('Nguyễn Thị Hoa');
    expect(result.displayName).toBe('Hoa');
    expect(result.title).toBe('Cô giáo Mầm non');
    expect(result.gender).toBe('female');
    expect(result.onboardingCompletedAt).toBe(now.toISOString());

    const stored = await accountRepo.findById('acc-2');
    expect(stored?.profile.onboardingCompletedAt).toEqual(now);
  });

  it('does NOT overwrite onboardingCompletedAt if onboarding was already completed', async () => {
    const initialCompleted = new Date('2026-10-20T08:00:00.000Z');
    const account = Account.registerWithPassword({
      id: 'acc-3',
      email: Email.create('teacher3@example.com'),
      profileId: 'prof-3',
      now: initialCompleted,
    });
    account.profile.update(
      {
        fullName: 'Trần Đức Linh',
        displayName: 'Linh',
        gender: 'male',
      },
      initialCompleted,
    );
    await accountRepo.createWithPassword(account, 'hash');

    const laterTime = new Date('2026-10-25T12:00:00.000Z');
    const laterUseCase = new UpdateProfileUseCase(accountRepo, new FixedClock(laterTime));

    const result = await laterUseCase.execute({
      accountId: 'acc-3',
      title: 'Thạc sĩ Toán',
    });

    expect(result.title).toBe('Thạc sĩ Toán');
    expect(result.onboardingCompletedAt).toBe(initialCompleted.toISOString());

    const stored = await accountRepo.findById('acc-3');
    expect(stored?.profile.onboardingCompletedAt).toEqual(initialCompleted);
  });

  it('deletes title when title is empty string or null', async () => {
    const account = Account.registerWithPassword({
      id: 'acc-4',
      email: Email.create('teacher4@example.com'),
      profileId: 'prof-4',
      now: new Date('2026-10-25T10:00:00.000Z'),
    });
    account.profile.update({
      fullName: 'Trần Đức Linh',
      displayName: 'Linh',
      title: 'Giáo viên',
      gender: 'male',
    });
    await accountRepo.createWithPassword(account, 'hash');

    const resultNull = await useCase.execute({
      accountId: 'acc-4',
      title: null,
    });
    expect(resultNull.title).toBeUndefined();

    const resultEmpty = await useCase.execute({
      accountId: 'acc-4',
      title: '   ',
    });
    expect(resultEmpty.title).toBeUndefined();
  });
});
