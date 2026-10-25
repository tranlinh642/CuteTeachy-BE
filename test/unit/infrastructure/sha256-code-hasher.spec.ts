import { Sha256CodeHasher } from '../../../src/infrastructure/google-auth/sha256-code-hasher';

describe('Sha256CodeHasher', () => {
  it('hashes a code consistently using SHA-256', () => {
    const hasher = new Sha256CodeHasher();
    const hash1 = hasher.hash('test-code-123');
    const hash2 = hasher.hash('test-code-123');
    const hash3 = hasher.hash('different-code');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toHaveLength(64); // sha256 hex string
  });
});
