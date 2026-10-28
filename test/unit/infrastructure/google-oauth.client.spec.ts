import { GoogleOAuthClientImpl } from '../../../src/infrastructure/google-auth/google-oauth.client';

describe('GoogleOAuthClientImpl', () => {
  const config = {
    clientId: 'test-client-id.apps.googleusercontent.com',
    clientSecret: 'test-client-secret',
    callbackUrl: 'http://localhost:4000/auth/google/callback',
  };

  let client: GoogleOAuthClientImpl;
  const originalFetch = global.fetch;

  beforeEach(() => {
    client = new GoogleOAuthClientImpl(config);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getAuthorizationUrl', () => {
    it('builds full Google authorization URL with state and scopes', () => {
      const urlString = client.getAuthorizationUrl('state_test_token_123');
      const url = new URL(urlString);

      expect(url.origin).toBe('https://accounts.google.com');
      expect(url.pathname).toBe('/o/oauth2/v2/auth');
      expect(url.searchParams.get('client_id')).toBe('test-client-id.apps.googleusercontent.com');
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:4000/auth/google/callback');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toBe('openid email profile');
      expect(url.searchParams.get('state')).toBe('state_test_token_123');
      expect(url.searchParams.get('access_type')).toBe('offline');
      expect(url.searchParams.get('prompt')).toBe('select_account');
    });
  });

  describe('getUserInfo', () => {
    it('exchanges code for tokens and fetches user info successfully', async () => {
      const mockFetch = jest
        .fn()
        // 1st call: token endpoint
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'google-access-token-xyz',
            id_token: 'google-id-token-abc',
          }),
        })
        // 2nd call: userinfo endpoint
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sub: 'google-sub-999',
            email: 'teacher@gmail.com',
            email_verified: true,
            name: 'Teacher Test',
            given_name: 'Teacher',
            picture: 'https://lh3.googleusercontent.com/avatar.jpg',
          }),
        });

      global.fetch = mockFetch as any;

      const userInfo = await client.getUserInfo('mock-auth-code');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
      expect(mockFetch.mock.calls[1][0]).toBe('https://www.googleapis.com/oauth2/v3/userinfo');

      expect(userInfo).toEqual({
        sub: 'google-sub-999',
        email: 'teacher@gmail.com',
        emailVerified: true,
        name: 'Teacher Test',
        givenName: 'Teacher',
        picture: 'https://lh3.googleusercontent.com/avatar.jpg',
      });
    });

    it('throws when token exchange response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      }) as any;

      await expect(client.getUserInfo('bad-code')).rejects.toThrow(
        'Failed to exchange Google OAuth code: Bad Request',
      );
    });

    it('throws when userinfo response is not ok', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'valid-token' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Unauthorized',
        }) as any;

      await expect(client.getUserInfo('code')).rejects.toThrow(
        'Failed to fetch Google user info: Unauthorized',
      );
    });
  });
});
