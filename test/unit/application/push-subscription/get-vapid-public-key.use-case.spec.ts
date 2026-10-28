import { GetVapidPublicKeyUseCase } from '../../../../src/application/push-subscription/get-vapid-public-key.use-case';
import { FakePushSender } from '../../../fakes/fake-push-sender';

describe('GetVapidPublicKeyUseCase', () => {
  it('returns the configured VAPID public key from push sender', async () => {
    const fakePushSender = new FakePushSender('test-custom-vapid-public-key');
    const useCase = new GetVapidPublicKeyUseCase(fakePushSender);

    const result = await useCase.execute();

    expect(result).toEqual({
      publicKey: 'test-custom-vapid-public-key',
    });
  });
});
