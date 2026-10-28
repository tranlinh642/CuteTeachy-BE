import { GetGoogleAuthUrlUseCase } from '../../../src/application/google-auth/get-google-auth-url.use-case';
import { GoogleOAuthClient } from '../../../src/application/google-auth/ports/google-oauth.client.port';
import { OAuthStateSigner } from '../../../src/application/google-auth/ports/oauth-state-signer.port';
import { IdGenerator } from '../../../src/application/shared/ports/id-generator.port';

describe('GetGoogleAuthUrlUseCase', () => {
  let useCase: GetGoogleAuthUrlUseCase;
  let googleClient: jest.Mocked<GoogleOAuthClient>;
  let stateSigner: jest.Mocked<OAuthStateSigner>;
  let idGenerator: jest.Mocked<IdGenerator>;

  beforeEach(() => {
    googleClient = {
      getAuthorizationUrl: jest.fn(),
      getUserInfo: jest.fn(),
    };
    stateSigner = {
      sign: jest.fn(),
      verify: jest.fn(),
    };
    idGenerator = {
      next: jest.fn(),
      generate: jest.fn(),
    };

    useCase = new GetGoogleAuthUrlUseCase(googleClient, stateSigner, idGenerator);
  });

  it('generates state with remember=true and returns Google authorization URL', async () => {
    idGenerator.next.mockReturnValue('nonce-123');
    stateSigner.sign.mockReturnValue('signed-state-token');
    googleClient.getAuthorizationUrl.mockReturnValue(
      'https://accounts.google.com/o/oauth2/v2/auth?state=signed-state-token',
    );

    const result = await useCase.execute({ remember: true });

    expect(idGenerator.next).toHaveBeenCalled();
    expect(stateSigner.sign).toHaveBeenCalledWith({
      remember: true,
      nonce: 'nonce-123',
    });
    expect(googleClient.getAuthorizationUrl).toHaveBeenCalledWith('signed-state-token');
    expect(result.url).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth?state=signed-state-token',
    );
  });

  it('defaults remember to false when not provided', async () => {
    idGenerator.next.mockReturnValue('nonce-456');
    stateSigner.sign.mockReturnValue('signed-state-token-2');
    googleClient.getAuthorizationUrl.mockReturnValue(
      'https://accounts.google.com/o/oauth2/v2/auth?state=signed-state-token-2',
    );

    const result = await useCase.execute({});

    expect(stateSigner.sign).toHaveBeenCalledWith({
      remember: false,
      nonce: 'nonce-456',
    });
    expect(result.url).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth?state=signed-state-token-2',
    );
  });
});
