import { Argon2PasswordHasher } from '../../../src/infrastructure/auth/argon2-password-hasher';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('hashes and verifies password using argon2id', async () => {
    const password = 'mySecretPassword123';
    const hash = await hasher.hash(password);

    expect(hash).toContain('$argon2id$');

    const isValid = await hasher.verify(password, hash);
    expect(isValid).toBe(true);

    const isInvalid = await hasher.verify('wrongPassword', hash);
    expect(isInvalid).toBe(false);
  }, 15000);

  it('returns false when verifying invalid hash format', async () => {
    const result = await hasher.verify('password', 'not-a-valid-argon2-hash');
    expect(result).toBe(false);
  });
});
