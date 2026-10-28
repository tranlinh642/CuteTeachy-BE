import { JwtOAuthStateSigner } from '../../../src/infrastructure/google-auth/jwt-oauth-state-signer';

describe('JwtOAuthStateSigner', () => {
  const secret = 'super-secret-key-at-least-32-chars-long';
  let signer: JwtOAuthStateSigner;

  beforeEach(() => {
    signer = new JwtOAuthStateSigner(secret, '10m');
  });

  it('signs and verifies payload with remember=true', () => {
    const token = signer.sign({ remember: true, nonce: 'test-nonce-1' });
    expect(typeof token).toBe('string');

    const verified = signer.verify(token);
    expect(verified).not.toBeNull();
    expect(verified?.remember).toBe(true);
    expect(verified?.nonce).toBe('test-nonce-1');
  });

  it('signs and verifies payload with remember=false', () => {
    const token = signer.sign({ remember: false, nonce: 'test-nonce-2' });
    const verified = signer.verify(token);
    expect(verified).not.toBeNull();
    expect(verified?.remember).toBe(false);
    expect(verified?.nonce).toBe('test-nonce-2');
  });

  it('returns null for tampered token', () => {
    const token = signer.sign({ remember: true, nonce: 'test-nonce-1' });
    const tampered = token.slice(0, -5) + 'xxxxx';
    expect(signer.verify(tampered)).toBeNull();
  });

  it('returns null for token signed with different secret', () => {
    const otherSigner = new JwtOAuthStateSigner('different-secret-key-32-chars-long', '10m');
    const token = otherSigner.sign({ remember: true, nonce: 'test-nonce-1' });
    expect(signer.verify(token)).toBeNull();
  });

  it('returns null for garbage string', () => {
    expect(signer.verify('not-a-token')).toBeNull();
    expect(signer.verify('')).toBeNull();
  });

  it('returns null for expired token', () => {
    const expiredSigner = new JwtOAuthStateSigner(secret, '-1s');
    const token = expiredSigner.sign({ remember: true, nonce: 'test-nonce-1' });
    expect(signer.verify(token)).toBeNull();
  });
});
