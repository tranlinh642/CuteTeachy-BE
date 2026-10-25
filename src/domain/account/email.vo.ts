import { AccountValidationError } from './account.errors';

export class Email {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private constructor(public readonly value: string) {}

  static create(raw: string): Email {
    if (!raw || typeof raw !== 'string') {
      throw new AccountValidationError('Email is required');
    }
    const normalized = raw.trim().toLowerCase();
    if (normalized.length === 0) {
      throw new AccountValidationError('Email cannot be empty');
    }
    if (!Email.EMAIL_REGEX.test(normalized)) {
      throw new AccountValidationError('Invalid email format');
    }
    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
