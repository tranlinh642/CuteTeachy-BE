import { DeletePushSubscriptionUseCase } from '../../../../src/application/push-subscription/delete-push-subscription.use-case';
import { InMemoryPushSubscriptionRepository } from '../../../fakes/in-memory-push-subscription.repository';
import { PushSubscription } from '../../../../src/domain/push-subscription/push-subscription.entity';
import { PushSubscriptionValidationError } from '../../../../src/domain/push-subscription/push-subscription.errors';

describe('DeletePushSubscriptionUseCase', () => {
  let repository: InMemoryPushSubscriptionRepository;
  let useCase: DeletePushSubscriptionUseCase;

  const baseKeys = {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  };
  const now = new Date('2026-10-27T10:00:00Z');

  beforeEach(() => {
    repository = new InMemoryPushSubscriptionRepository();
    useCase = new DeletePushSubscriptionUseCase(repository);
  });

  it('deletes an existing subscription belonging to the account', async () => {
    const sub = PushSubscription.create({
      id: 'sub-1',
      accountId: 'account-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
      keys: baseKeys,
      now,
    });
    await repository.save(sub);

    await useCase.execute({
      accountId: 'account-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
    });

    const found = await repository.findByEndpoint('https://fcm.googleapis.com/fcm/send/device-1');
    expect(found).toBeNull();
  });

  it('does nothing and completes successfully when endpoint does not exist', async () => {
    await expect(
      useCase.execute({
        accountId: 'account-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/non-existent',
      }),
    ).resolves.toBeUndefined();
  });

  it('does not delete a subscription if it belongs to another account', async () => {
    const sub = PushSubscription.create({
      id: 'sub-2',
      accountId: 'account-other',
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-other',
      keys: baseKeys,
      now,
    });
    await repository.save(sub);

    // account-1 tries to delete account-other's subscription
    await useCase.execute({
      accountId: 'account-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-other',
    });

    const found = await repository.findByEndpoint(
      'https://fcm.googleapis.com/fcm/send/device-other',
    );
    expect(found).not.toBeNull();
    expect(found?.accountId).toBe('account-other');
  });

  it('throws validation error if accountId or endpoint is empty', async () => {
    await expect(
      useCase.execute({
        accountId: '',
        endpoint: 'https://push.example.com',
      }),
    ).rejects.toThrow(PushSubscriptionValidationError);

    await expect(
      useCase.execute({
        accountId: 'account-1',
        endpoint: ' ',
      }),
    ).rejects.toThrow(PushSubscriptionValidationError);
  });
});
