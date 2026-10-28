import { Email } from '../../../src/domain/account/email.vo';
import { Password } from '../../../src/domain/account/password.vo';
import { Account } from '../../../src/domain/account/account.entity';
import { AccountValidationError } from '../../../src/domain/account/account.errors';

describe('Account Domain', () => {
  describe('Email Value Object', () => {
    it('trims and lowercases valid email', () => {
      const email = Email.create('  Teacher.Cute@example.COM  ');
      expect(email.value).toBe('teacher.cute@example.com');
    });

    it('rejects invalid email formats with validation error', () => {
      expect(() => Email.create('not-an-email')).toThrow(AccountValidationError);
      try {
        Email.create('not-an-email');
      } catch (err: any) {
        expect(err.code).toBe('validation');
      }
    });

    it('rejects empty email', () => {
      expect(() => Email.create('   ')).toThrow(AccountValidationError);
    });
  });

  describe('Password Value Object', () => {
    it('accepts password with length between 8 and 72', () => {
      const p8 = Password.create('12345678');
      expect(p8.value).toBe('12345678');

      const p72 = Password.create('a'.repeat(72));
      expect(p72.value).toBe('a'.repeat(72));
    });

    it('rejects password shorter than 8 characters', () => {
      expect(() => Password.create('1234567')).toThrow(AccountValidationError);
      try {
        Password.create('1234567');
      } catch (err: any) {
        expect(err.code).toBe('validation');
      }
    });

    it('rejects password longer than 72 characters', () => {
      expect(() => Password.create('a'.repeat(73))).toThrow(AccountValidationError);
      try {
        Password.create('a'.repeat(73));
      } catch (err: any) {
        expect(err.code).toBe('validation');
      }
    });
  });

  describe('Account Entity', () => {
    it('creates a new account with password registration defaults', () => {
      const email = Email.create('teacher@example.com');
      const account = Account.registerWithPassword({
        id: 'acc-123',
        email,
        profileId: 'prof-123',
      });

      expect(account.id).toBe('acc-123');
      expect(account.email).toBe('teacher@example.com');
      expect(account.emailVerifiedAt).toBeNull();
      expect(account.loginProviders).toEqual(['password']);
      expect(account.profile.fullName).toBe('');
      expect(account.profile.displayName).toBe('');
      expect(account.profile.gender).toBeNull();
      expect(account.profile.onboardingCompletedAt).toBeNull();
      expect(account.profile.title).toBeUndefined();
      expect(account.profile.avatarUrl).toBeUndefined();
    });

    it('creates a new account with google registration defaults', () => {
      const email = Email.create('teacher.google@example.com');
      const now = new Date('2026-10-25T10:00:00Z');
      const account = Account.registerWithGoogle({
        id: 'acc-google-1',
        email,
        profileId: 'prof-google-1',
        fullName: 'Cute Teacher',
        displayName: 'Teacher Cute',
        avatarUrl: 'https://lh3.googleusercontent.com/avatar.jpg',
        now,
      });

      expect(account.id).toBe('acc-google-1');
      expect(account.email).toBe('teacher.google@example.com');
      expect(account.emailVerifiedAt).toEqual(now);
      expect(account.loginProviders).toEqual(['google']);
      expect(account.hasLoginProvider('google')).toBe(true);
      expect(account.profile.fullName).toBe('Cute Teacher');
      expect(account.profile.displayName).toBe('Teacher Cute');
      expect(account.profile.avatarUrl).toBe('https://lh3.googleusercontent.com/avatar.jpg');
      expect(account.profile.gender).toBeNull();
      expect(account.profile.onboardingCompletedAt).toBeNull();
    });

    it('links google provider to existing account idempotently', () => {
      const email = Email.create('teacher@example.com');
      const account = Account.registerWithPassword({
        id: 'acc-123',
        email,
        profileId: 'prof-123',
      });

      expect(account.hasLoginProvider('password')).toBe(true);
      expect(account.hasLoginProvider('google')).toBe(false);

      account.linkGoogle();
      expect(account.hasLoginProvider('google')).toBe(true);
      expect(account.loginProviders).toContain('password');
      expect(account.loginProviders).toContain('google');

      // Idempotency
      account.linkGoogle();
      expect(account.loginProviders.filter((p: string) => p === 'google')).toHaveLength(1);
    });

    it('verifies email and updates emailVerifiedAt timestamp', () => {
      const email = Email.create('teacher@example.com');
      const account = Account.registerWithPassword({
        id: 'acc-123',
        email,
        profileId: 'prof-123',
      });

      expect(account.emailVerifiedAt).toBeNull();
      const verifiedTime = new Date('2026-10-25T11:00:00Z');
      account.verifyEmail(verifiedTime);
      expect(account.emailVerifiedAt).toEqual(verifiedTime);
    });
  });
});
