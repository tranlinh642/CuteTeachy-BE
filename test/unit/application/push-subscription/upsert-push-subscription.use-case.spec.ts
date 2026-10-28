import { UpsertPushSubscriptionUseCase } from '../../../../src/application/push-subscription/upsert-push-subscription.use-case';
import { InMemoryPushSubscriptionRepository } from '../../../fakes/in-memory-push-subscription.repository';
import { FixedClock } from '../../../fakes/fixed-clock';
import { SequentialIdGenerator } from '../../../fakes/sequential-id-generator';
import { PushSubscriptionValidationError } from '../../../../src/domain/push-subscription/push-subscription.errors';

describe('UpsertPushSubscriptionUseCase', () => {
  let repository: InMemoryPushSubscriptionRepository;
  let clock: FixedClock;
  let idGenerator: SequentialIdGenerator;
  let useCase: UpsertPushSubscriptionUseCase;

  const baseKeys = {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  };

  beforeEach(() => {
    repository = new InMemoryPushSubscriptionRepository();
    clock = new FixedClock(new Date('2026-10-27T10:00:00Z'));
    idGenerator = new SequentialIdGenerator('sub');
    useCase = new UpsertPushSubscriptionUseCase(repository, clock, idGenerator);
  });

  it('creates a new subscription when endpoint does not exist', async () => {
    const result = await useCase.execute({
      accountId: 'account-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-a',
      keys: baseKeys,
    });

    expect(result.created).toBe(true);
    expect(result.subscription.id).toBe('sub-1');
    expect(result.subscription.accountId).toBe('account-1');
    expect(result.subscription.endpoint).toBe('https://fcm.googleapis.com/fcm/send/device-a');
    expect(result.subscription.keys).toEqual(baseKeys);

    const saved = await repository.findByEndpoint('https://fcm.googleapis.com/fcm/send/device-a');
    expect(saved).not.toBeNull();
    expect(saved?.accountId).toBe('account-1');
  });

  it('updates an existing subscription for the same account with new keys', async () => {
    // First create
    await useCase.execute({
      accountId: 'account-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-a',
      keys: baseKeys,
    });

    clock.advance(60000); // 1 minute later
    const newKeys = {
      p256dh: 'updated-p256dh',
      auth: 'updated-auth',
    };

    const updateResult = await useCase.execute({
      accountId: 'account-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-a',
      keys: newKeys,
    });

    expect(updateResult.created).toBe(false);
    expect(updateResult.subscription.id).toBe('sub-1');
    expect(updateResult.subscription.accountId).toBe('account-1');
    expect(updateResult.subscription.keys).toEqual(newKeys);
    expect(new Date(updateResult.subscription.updatedAt).getTime()).toBeGreaterThan(
      new Date(updateResult.subscription.createdAt).getTime(),
    );

    const saved = await repository.findByEndpoint('https://fcm.googleapis.com/fcm/send/device-a');
    expect(saved?.keys.p256dh).toBe('updated-p256dh');
  });

  it('reassigns existing endpoint to the new account when endpoint belonged to another account', async () => {
    // Created originally by account-1
    await useCase.execute({
      accountId: 'account-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-shared',
      keys: baseKeys,
    });

    clock.advance(120000); // 2 minutes later
    const newKeys = {
      p256dh: 'account-2-p256dh',
      auth: 'account-2-auth',
    };

    // Now account-2 registers the same device endpoint
    const result = await useCase.execute({
      accountId: 'account-2',
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-shared',
      keys: newKeys,
    });

    expect(result.created).toBe(false);
    expect(result.subscription.accountId).toBe('account-2');
    expect(result.subscription.keys).toEqual(newKeys);

    const saved = await repository.findByEndpoint(
      'https://fcm.googleapis.com/fcm/send/device-shared',
    );
    expect(saved?.accountId).toBe('account-2');

    // account-1 should no longer have this subscription
    const account1Subs = await repository.findByAccountId('account-1');
    expect(account1Subs).toHaveLength(0);

    const account2Subs = await repository.findByAccountId('account-2');
    expect(account2Subs).toHaveLength(1);
    expect(account2Subs[0].endpoint).toBe('https://fcm.googleapis.com/fcm/send/device-shared');
  });

  it('throws validation error if accountId or endpoint is empty', async () => {
    await expect(
      useCase.execute({
        accountId: '',
        endpoint: 'https://push.example.com',
        keys: baseKeys,
      }),
    ).rejects.toThrow(PushSubscriptionValidationError);

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        endpoint: '   ',
        keys: baseKeys,
      }),
    ).rejects.toThrow(PushSubscriptionValidationError);
  });
});
