import { AccountValidationError } from './account.errors';

export class Password {
  public static readonly MIN_LENGTH = 8;
  public static readonly MAX_LENGTH = 72;

  private constructor(public readonly value: string) {}

  static create(raw: string): Password {
    if (!raw || typeof raw !== 'string') {
      throw new AccountValidationError('Password is required');
    }
    if (raw.length < Password.MIN_LENGTH || raw.length > Password.MAX_LENGTH) {
      throw new AccountValidationError(
        `Password must be between ${Password.MIN_LENGTH} and ${Password.MAX_LENGTH} characters long`,
      );
    }
    return new Password(raw);
  }
}
