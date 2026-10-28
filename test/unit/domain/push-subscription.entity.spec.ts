import { PushSubscription } from '../../../src/domain/push-subscription/push-subscription.entity';
import { PushSubscriptionKeys } from '../../../src/domain/push-subscription/push-subscription.vo';
import { PushSubscriptionValidationError } from '../../../src/domain/push-subscription/push-subscription.errors';

describe('PushSubscription Domain Entity', () => {
  const baseKeys = {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  };
  const now = new Date('2026-10-27T10:00:00Z');

  describe('PushSubscriptionKeys Value Object', () => {
    it('creates valid keys', () => {
      const keys = PushSubscriptionKeys.create(baseKeys);
      expect(keys.p256dh).toBe(baseKeys.p256dh);
      expect(keys.auth).toBe(baseKeys.auth);
      expect(keys.toJSON()).toEqual(baseKeys);
    });

    it('throws validation error when p256dh is empty or missing', () => {
      expect(() => PushSubscriptionKeys.create({ p256dh: '', auth: 'auth-key' })).toThrow(
        PushSubscriptionValidationError,
      );
    });

    it('throws validation error when auth is empty or missing', () => {
      expect(() => PushSubscriptionKeys.create({ p256dh: 'p256dh-key', auth: '   ' })).toThrow(
        PushSubscriptionValidationError,
      );
    });
  });

  describe('PushSubscription Entity', () => {
    it('creates a new PushSubscription entity successfully', () => {
      const sub = PushSubscription.create({
        id: 'sub-1',
        accountId: 'acc-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
        keys: baseKeys,
        now,
      });

      expect(sub.id).toBe('sub-1');
      expect(sub.accountId).toBe('acc-1');
      expect(sub.endpoint).toBe('https://fcm.googleapis.com/fcm/send/device-1');
      expect(sub.keys.p256dh).toBe(baseKeys.p256dh);
      expect(sub.keys.auth).toBe(baseKeys.auth);
      expect(sub.createdAt).toEqual(now);
      expect(sub.updatedAt).toEqual(now);
    });

    it('throws error if id is missing', () => {
      expect(() =>
        PushSubscription.create({
          id: '',
          accountId: 'acc-1',
          endpoint: 'https://push.example.com',
          keys: baseKeys,
          now,
        }),
      ).toThrow(PushSubscriptionValidationError);
    });

    it('throws error if accountId is missing', () => {
      expect(() =>
        PushSubscription.create({
          id: 'sub-1',
          accountId: ' ',
          endpoint: 'https://push.example.com',
          keys: baseKeys,
          now,
        }),
      ).toThrow(PushSubscriptionValidationError);
    });

    it('throws error if endpoint is missing', () => {
      expect(() =>
        PushSubscription.create({
          id: 'sub-1',
          accountId: 'acc-1',
          endpoint: '',
          keys: baseKeys,
          now,
        }),
      ).toThrow(PushSubscriptionValidationError);
    });

    it('reconstitutes an existing subscription from persistence', () => {
      const createdAt = new Date('2026-10-26T00:00:00Z');
      const updatedAt = new Date('2026-10-27T08:00:00Z');
      const sub = PushSubscription.reconstitute({
        id: 'sub-persisted',
        accountId: 'acc-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/persisted',
        keys: baseKeys,
        createdAt,
        updatedAt,
      });

      expect(sub.id).toBe('sub-persisted');
      expect(sub.createdAt).toEqual(createdAt);
      expect(sub.updatedAt).toEqual(updatedAt);
    });

    it('reassigns subscription to a new account and updates keys', () => {
      const sub = PushSubscription.create({
        id: 'sub-1',
        accountId: 'acc-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
        keys: baseKeys,
        now,
      });

      const updatedTime = new Date('2026-10-27T11:00:00Z');
      const newKeys = {
        p256dh: 'new-p256dh',
        auth: 'new-auth',
      };

      sub.reassignToAccount('acc-2', newKeys, updatedTime);

      expect(sub.accountId).toBe('acc-2');
      expect(sub.keys.p256dh).toBe('new-p256dh');
      expect(sub.keys.auth).toBe('new-auth');
      expect(sub.updatedAt).toEqual(updatedTime);
      expect(sub.createdAt).toEqual(now);
    });

    it('updates keys and updatedAt timestamp', () => {
      const sub = PushSubscription.create({
        id: 'sub-1',
        accountId: 'acc-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
        keys: baseKeys,
        now,
      });

      const updatedTime = new Date('2026-10-27T11:00:00Z');
      const newKeys = {
        p256dh: 'updated-p256dh',
        auth: 'updated-auth',
      };

      sub.updateKeys(newKeys, updatedTime);

      expect(sub.accountId).toBe('acc-1');
      expect(sub.keys.p256dh).toBe('updated-p256dh');
      expect(sub.keys.auth).toBe('updated-auth');
      expect(sub.updatedAt).toEqual(updatedTime);
    });
  });
});
