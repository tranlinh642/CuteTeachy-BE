import { Profile } from '../../../src/domain/account/profile.entity';

describe('Profile Entity & Onboarding Rule', () => {
  const accountId = 'acc-123';
  const profileId = 'prof-123';
  const initialDate = new Date('2026-10-25T10:00:00.000Z');

  it('creates an empty profile with null onboardingCompletedAt', () => {
    const profile = Profile.createEmpty(accountId, profileId, initialDate);

    expect(profile.id).toBe(profileId);
    expect(profile.accountId).toBe(accountId);
    expect(profile.fullName).toBe('');
    expect(profile.displayName).toBe('');
    expect(profile.title).toBeUndefined();
    expect(profile.gender).toBeNull();
    expect(profile.onboardingCompletedAt).toBeNull();
    expect(profile.isOnboardingCompleted).toBe(false);
    expect(profile.createdAt).toEqual(initialDate);
    expect(profile.updatedAt).toEqual(initialDate);
  });

  describe('Onboarding completion rules', () => {
    it('does NOT mark onboarding complete when gender is missing (null)', () => {
      const profile = Profile.createEmpty(accountId, profileId, initialDate);
      const updateDate = new Date('2026-10-25T10:05:00.000Z');

      profile.update(
        {
          fullName: 'Trần Đức Linh',
          displayName: 'Linh',
          gender: null,
        },
        updateDate,
      );

      expect(profile.fullName).toBe('Trần Đức Linh');
      expect(profile.displayName).toBe('Linh');
      expect(profile.gender).toBeNull();
      expect(profile.onboardingCompletedAt).toBeNull();
      expect(profile.isOnboardingCompleted).toBe(false);
      expect(profile.updatedAt).toEqual(updateDate);
    });

    it('does NOT mark onboarding complete when fullName is empty or whitespace-only', () => {
      const profile = Profile.createEmpty(accountId, profileId, initialDate);
      const updateDate = new Date('2026-10-25T10:05:00.000Z');

      profile.update(
        {
          fullName: '   ',
          displayName: 'Linh',
          gender: 'male',
        },
        updateDate,
      );

      expect(profile.fullName).toBe('');
      expect(profile.displayName).toBe('Linh');
      expect(profile.gender).toBe('male');
      expect(profile.onboardingCompletedAt).toBeNull();
      expect(profile.isOnboardingCompleted).toBe(false);
    });

    it('does NOT mark onboarding complete when displayName is empty or whitespace-only', () => {
      const profile = Profile.createEmpty(accountId, profileId, initialDate);
      const updateDate = new Date('2026-10-25T10:05:00.000Z');

      profile.update(
        {
          fullName: 'Trần Đức Linh',
          displayName: '  ',
          gender: 'male',
        },
        updateDate,
      );

      expect(profile.fullName).toBe('Trần Đức Linh');
      expect(profile.displayName).toBe('');
      expect(profile.gender).toBe('male');
      expect(profile.onboardingCompletedAt).toBeNull();
      expect(profile.isOnboardingCompleted).toBe(false);
    });

    it('marks onboarding completed when all required fields (fullName, displayName, gender) are provided for the first time', () => {
      const profile = Profile.createEmpty(accountId, profileId, initialDate);
      const completedDate = new Date('2026-10-25T10:10:00.000Z');

      profile.update(
        {
          fullName: '  Trần Đức Linh  ',
          displayName: '  Linh  ',
          gender: 'male',
          title: 'Giáo viên Toán',
        },
        completedDate,
      );

      expect(profile.fullName).toBe('Trần Đức Linh');
      expect(profile.displayName).toBe('Linh');
      expect(profile.gender).toBe('male');
      expect(profile.title).toBe('Giáo viên Toán');
      expect(profile.onboardingCompletedAt).toEqual(completedDate);
      expect(profile.isOnboardingCompleted).toBe(true);
      expect(profile.updatedAt).toEqual(completedDate);
    });

    it('does NOT overwrite onboardingCompletedAt if onboarding was already completed', () => {
      const alreadyCompletedDate = new Date('2026-10-20T08:00:00.000Z');
      const profile = Profile.reconstitute({
        id: profileId,
        accountId,
        fullName: 'Trần Đức Linh',
        displayName: 'Linh',
        title: 'Thầy Linh',
        gender: 'male',
        onboardingCompletedAt: alreadyCompletedDate,
        createdAt: initialDate,
        updatedAt: alreadyCompletedDate,
      });

      const laterDate = new Date('2026-10-25T11:00:00.000Z');
      profile.update(
        {
          displayName: 'Thầy Linh Cute',
          title: 'Chuyên gia Toán',
        },
        laterDate,
      );

      expect(profile.displayName).toBe('Thầy Linh Cute');
      expect(profile.title).toBe('Chuyên gia Toán');
      expect(profile.onboardingCompletedAt).toEqual(alreadyCompletedDate);
      expect(profile.updatedAt).toEqual(laterDate);
    });
  });

  describe('Title handling', () => {
    it('deletes title when empty string or whitespace-only is passed', () => {
      const profile = Profile.reconstitute({
        id: profileId,
        accountId,
        fullName: 'Trần Đức Linh',
        displayName: 'Linh',
        title: 'Thầy giáo',
        gender: 'male',
        onboardingCompletedAt: initialDate,
        createdAt: initialDate,
        updatedAt: initialDate,
      });

      profile.update({ title: '   ' });
      expect(profile.title).toBeUndefined();
    });

    it('deletes title when null is passed', () => {
      const profile = Profile.reconstitute({
        id: profileId,
        accountId,
        fullName: 'Trần Đức Linh',
        displayName: 'Linh',
        title: 'Thầy giáo',
        gender: 'male',
        onboardingCompletedAt: initialDate,
        createdAt: initialDate,
        updatedAt: initialDate,
      });

      profile.update({ title: null });
      expect(profile.title).toBeUndefined();
    });

    it('preserves title when undefined is passed', () => {
      const profile = Profile.reconstitute({
        id: profileId,
        accountId,
        fullName: 'Trần Đức Linh',
        displayName: 'Linh',
        title: 'Thầy giáo',
        gender: 'male',
        onboardingCompletedAt: initialDate,
        createdAt: initialDate,
        updatedAt: initialDate,
      });

      profile.update({ displayName: 'Linh mới' });
      expect(profile.title).toBe('Thầy giáo');
    });
  });
});
