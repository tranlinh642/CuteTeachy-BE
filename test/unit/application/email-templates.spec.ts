import {
  resolveLanguage,
  buildEmailVerificationEmail,
  buildPasswordResetEmail,
} from '../../../src/application/email-templates/verification-email.template';

describe('Verification Email Templates', () => {
  describe('resolveLanguage', () => {
    it('defaults to vi when header is empty, undefined or unrecognised', () => {
      expect(resolveLanguage(undefined)).toBe('vi');
      expect(resolveLanguage('')).toBe('vi');
      expect(resolveLanguage('fr-FR,fr;q=0.9')).toBe('vi');
    });

    it('resolves en when Accept-Language indicates English', () => {
      expect(resolveLanguage('en-US,en;q=0.9')).toBe('en');
      expect(resolveLanguage('en')).toBe('en');
    });

    it('resolves vi when Accept-Language indicates Vietnamese', () => {
      expect(resolveLanguage('vi-VN,vi;q=0.9')).toBe('vi');
    });
  });

  describe('buildEmailVerificationEmail', () => {
    it('generates Vietnamese verification email with 6-digit code', () => {
      const email = buildEmailVerificationEmail('654321', 'vi');
      expect(email.subject).toContain('654321');
      expect(email.html).toContain('654321');
      expect(email.html).toContain('10 phút');
      expect(email.text).toContain('654321');
    });

    it('generates English verification email with 6-digit code', () => {
      const email = buildEmailVerificationEmail('654321', 'en');
      expect(email.subject).toContain('654321');
      expect(email.html).toContain('654321');
      expect(email.html).toContain('10 minutes');
      expect(email.text).toContain('654321');
    });
  });

  describe('buildPasswordResetEmail', () => {
    it('generates Vietnamese password reset email', () => {
      const email = buildPasswordResetEmail('888999', 'vi');
      expect(email.subject).toContain('888999');
      expect(email.html).toContain('888999');
      expect(email.html).toContain('10 phút');
    });

    it('generates English password reset email', () => {
      const email = buildPasswordResetEmail('888999', 'en');
      expect(email.subject).toContain('888999');
      expect(email.html).toContain('888999');
      expect(email.html).toContain('10 minutes');
    });
  });
});
