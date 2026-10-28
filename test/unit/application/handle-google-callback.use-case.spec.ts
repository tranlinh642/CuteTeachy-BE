import { HandleGoogleCallbackUseCase } from '../../../src/application/google-auth/handle-google-callback.use-case';
import { GoogleOAuthClient, GoogleUserInfo } from '../../../src/application/google-auth/ports/google-oauth.client.port';
import { OAuthStateSigner } from '../../../src/application/google-auth/ports/oauth-state-signer.port';
import { OneTimeExchangeCodeRepository } from '../../../src/application/google-auth/ports/one-time-exchange-code.repository.port';
import { GoogleAuthAccountRepository } from '../../../src/application/google-auth/ports/google-auth-account.repository.port';
import { CodeHasher } from '../../../src/application/google-auth/ports/code-hasher.port';
import { IdGenerator } from '../../../src/application/shared/ports/id-generator.port';
import { Clock } from '../../../src/application/shared/ports/clock.port';
import { Account } from '../../../src/domain/account/account.entity';
import { Email } from '../../../src/domain/account/email.vo';
import { InMemorySettingsRepository } from '../../fakes/in-memory-settings.repository';

describe('HandleGoogleCallbackUseCase', () => {
  const feUrl = 'http://localhost:3000';
  let useCase: HandleGoogleCallbackUseCase;
  let accountRepo: jest.Mocked<GoogleAuthAccountRepository>;
  let exchangeCodeRepo: jest.Mocked<OneTimeExchangeCodeRepository>;
  let googleClient: jest.Mocked<GoogleOAuthClient>;
  let stateSigner: jest.Mocked<OAuthStateSigner>;
  let codeHasher: jest.Mocked<CodeHasher>;
  let idGenerator: jest.Mocked<IdGenerator>;
  let clock: jest.Mocked<Clock>;

  const fixedNow = new Date('2026-10-25T12:00:00Z');

  beforeEach(() => {
    accountRepo = {
      findByProviderSubject: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      createWithGoogle: jest.fn(),
      linkGoogleProvider: jest.fn(),
    };
    exchangeCodeRepo = {
      create: jest.fn(),
      consume: jest.fn(),
    };
    googleClient = {
      getAuthorizationUrl: jest.fn(),
      getUserInfo: jest.fn(),
    };
    stateSigner = {
      sign: jest.fn(),
      verify: jest.fn(),
    };
    codeHasher = {
      hash: jest.fn().mockImplementation((c) => `hashed_${c}`),
    };
    let idCounter = 1;
    idGenerator = {
      next: jest.fn().mockImplementation(() => `id-${idCounter++}`),
      generate: jest.fn().mockReturnValue('random-one-time-code-12345'),
    };
    clock = {
      now: jest.fn().mockReturnValue(fixedNow),
    };

    useCase = new HandleGoogleCallbackUseCase(
      accountRepo,
      exchangeCodeRepo,
      googleClient,
      stateSigner,
      codeHasher,
      idGenerator,
      clock,
      feUrl,
    );
  });

  describe('Error handling (redirects to google_failed)', () => {
    it('redirects with google_failed when query params contain error', async () => {
      const result = await useCase.execute({
        error: 'access_denied',
        state: 'some-state',
      });
      expect(result.redirectUrl).toBe('http://localhost:3000/auth/callback?error=google_failed');
      expect(googleClient.getUserInfo).not.toHaveBeenCalled();
    });

    it('redirects with google_failed when code or state is missing', async () => {
      const result1 = await useCase.execute({ state: 'valid-state' });
      expect(result1.redirectUrl).toBe('http://localhost:3000/auth/callback?error=google_failed');

      const result2 = await useCase.execute({ code: 'valid-code' });
      expect(result2.redirectUrl).toBe('http://localhost:3000/auth/callback?error=google_failed');
    });

    it('redirects with google_failed when state signature verification fails', async () => {
      stateSigner.verify.mockReturnValue(null);

      const result = await useCase.execute({
        code: 'valid-code',
        state: 'invalid-or-tampered-state',
      });
      expect(result.redirectUrl).toBe('http://localhost:3000/auth/callback?error=google_failed');
      expect(googleClient.getUserInfo).not.toHaveBeenCalled();
    });

    it('redirects with google_failed when Google OAuth exchange throws an error', async () => {
      stateSigner.verify.mockReturnValue({ remember: true, nonce: 'nonce-1' });
      googleClient.getUserInfo.mockRejectedValue(new Error('Google network error'));

      const result = await useCase.execute({
        code: 'google-code',
        state: 'valid-state',
      });
      expect(result.redirectUrl).toBe('http://localhost:3000/auth/callback?error=google_failed');
    });

    it('redirects with google_failed when Google email is not verified', async () => {
      stateSigner.verify.mockReturnValue({ remember: true, nonce: 'nonce-1' });
      googleClient.getUserInfo.mockResolvedValue({
        sub: 'google-sub-1',
        email: 'unverified@example.com',
        emailVerified: false,
      });

      const result = await useCase.execute({
        code: 'google-code',
        state: 'valid-state',
      });
      expect(result.redirectUrl).toBe('http://localhost:3000/auth/callback?error=google_failed');
      expect(accountRepo.findByProviderSubject).not.toHaveBeenCalled();
    });
  });

  describe('Success scenarios', () => {
    const verifiedGoogleUser: GoogleUserInfo = {
      sub: 'google-sub-100',
      email: 'teacher.cute@gmail.com',
      emailVerified: true,
      name: 'Nguyen Van Cute',
      givenName: 'Cute',
      picture: 'https://lh3.googleusercontent.com/cute.jpg',
    };

    it('registers new Account via Google when neither subject nor email exists', async () => {
      stateSigner.verify.mockReturnValue({ remember: true, nonce: 'nonce-1' });
      googleClient.getUserInfo.mockResolvedValue(verifiedGoogleUser);
      accountRepo.findByProviderSubject.mockResolvedValue(null);
      accountRepo.findByEmail.mockResolvedValue(null);

      const result = await useCase.execute({
        code: 'google-code-1',
        state: 'valid-state-1',
      });

      expect(accountRepo.findByProviderSubject).toHaveBeenCalledWith('google', 'google-sub-100');
      expect(accountRepo.findByEmail).toHaveBeenCalledWith('teacher.cute@gmail.com');

      // Account created with Google
      expect(accountRepo.createWithGoogle).toHaveBeenCalledTimes(1);
      const createdAccount = accountRepo.createWithGoogle.mock.calls[0][0];
      const subject = accountRepo.createWithGoogle.mock.calls[0][1];
      expect(subject).toBe('google-sub-100');
      expect(createdAccount.email).toBe('teacher.cute@gmail.com');
      expect(createdAccount.emailVerifiedAt).toEqual(fixedNow);
      expect(createdAccount.loginProviders).toEqual(['google']);
      expect(createdAccount.profile.fullName).toBe('Nguyen Van Cute');
      expect(createdAccount.profile.displayName).toBe('Cute');
      expect(createdAccount.profile.avatarUrl).toBe('https://lh3.googleusercontent.com/cute.jpg');
      expect(createdAccount.profile.gender).toBeNull();
      expect(createdAccount.profile.onboardingCompletedAt).toBeNull();

      // One-time code created
      expect(exchangeCodeRepo.create).toHaveBeenCalledWith({
        id: expect.any(String),
        accountId: createdAccount.id,
        codeHash: 'hashed_random-one-time-code-12345',
        remember: true,
        expiresAt: new Date(fixedNow.getTime() + 60 * 1000),
      });

      expect(result.redirectUrl).toBe(
        'http://localhost:3000/auth/callback?code=random-one-time-code-12345',
      );
    });

    it('links Google to existing Account when email matches existing password account', async () => {
      stateSigner.verify.mockReturnValue({ remember: false, nonce: 'nonce-2' });
      googleClient.getUserInfo.mockResolvedValue(verifiedGoogleUser);
      accountRepo.findByProviderSubject.mockResolvedValue(null);

      const existingAccount = Account.registerWithPassword({
        id: 'existing-acc-id',
        email: Email.create('teacher.cute@gmail.com'),
        profileId: 'existing-prof-id',
      });
      accountRepo.findByEmail.mockResolvedValue(existingAccount);

      const result = await useCase.execute({
        code: 'google-code-2',
        state: 'valid-state-2',
      });

      expect(accountRepo.findByProviderSubject).toHaveBeenCalledWith('google', 'google-sub-100');
      expect(accountRepo.findByEmail).toHaveBeenCalledWith('teacher.cute@gmail.com');
      expect(accountRepo.createWithGoogle).not.toHaveBeenCalled();
      expect(accountRepo.linkGoogleProvider).toHaveBeenCalledWith('existing-acc-id', 'google-sub-100');

      expect(exchangeCodeRepo.create).toHaveBeenCalledWith({
        id: expect.any(String),
        accountId: 'existing-acc-id',
        codeHash: 'hashed_random-one-time-code-12345',
        remember: false,
        expiresAt: new Date(fixedNow.getTime() + 60 * 1000),
      });

      expect(result.redirectUrl).toBe(
        'http://localhost:3000/auth/callback?code=random-one-time-code-12345',
      );
    });

    it('creates default settings with vi locale when registering new Account via Google', async () => {
      const settingsRepo = new InMemorySettingsRepository();
      const customUseCase = new HandleGoogleCallbackUseCase(
        accountRepo,
        exchangeCodeRepo,
        googleClient,
        stateSigner,
        codeHasher,
        idGenerator,
        clock,
        feUrl,
        settingsRepo,
      );

      stateSigner.verify.mockReturnValue({ remember: true, nonce: 'nonce-new' });
      googleClient.getUserInfo.mockResolvedValue(verifiedGoogleUser);
      accountRepo.findByProviderSubject.mockResolvedValue(null);
      accountRepo.findByEmail.mockResolvedValue(null);

      await customUseCase.execute({
        code: 'google-code-new',
        state: 'valid-state-new',
      });

      expect(accountRepo.createWithGoogle).toHaveBeenCalledTimes(1);
      const createdAccount = accountRepo.createWithGoogle.mock.calls[0][0];

      const settings = await settingsRepo.findByAccountId(createdAccount.id);
      expect(settings).not.toBeNull();
      expect(settings?.locale).toBe('vi');
      expect(settings?.timeZone).toBe('Asia/Ho_Chi_Minh');
      expect(settings?.pushEnabled).toBe(true);
      expect(settings?.reminderLeadMinutes).toBe(15);
    });

    it('finds existing Account by subject on subsequent Google logins', async () => {
      stateSigner.verify.mockReturnValue({ remember: true, nonce: 'nonce-3' });
      googleClient.getUserInfo.mockResolvedValue(verifiedGoogleUser);

      const existingGoogleAccount = Account.registerWithGoogle({
        id: 'google-acc-id',
        email: Email.create('teacher.cute@gmail.com'),
        profileId: 'google-prof-id',
      });
      accountRepo.findByProviderSubject.mockResolvedValue(existingGoogleAccount);

      const result = await useCase.execute({
        code: 'google-code-3',
        state: 'valid-state-3',
      });

      expect(accountRepo.findByProviderSubject).toHaveBeenCalledWith('google', 'google-sub-100');
      expect(accountRepo.findByEmail).not.toHaveBeenCalled();
      expect(accountRepo.createWithGoogle).not.toHaveBeenCalled();
      expect(accountRepo.linkGoogleProvider).not.toHaveBeenCalled();

      expect(exchangeCodeRepo.create).toHaveBeenCalledWith({
        id: expect.any(String),
        accountId: 'google-acc-id',
        codeHash: 'hashed_random-one-time-code-12345',
        remember: true,
        expiresAt: new Date(fixedNow.getTime() + 60 * 1000),
      });

      expect(result.redirectUrl).toBe(
        'http://localhost:3000/auth/callback?code=random-one-time-code-12345',
      );
    });
  });
});
