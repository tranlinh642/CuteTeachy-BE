import type { PushSubscription } from '../../../domain/push-subscription/push-subscription.entity';

export const PUSH_SUBSCRIPTION_REPOSITORY = Symbol('PUSH_SUBSCRIPTION_REPOSITORY');

export interface PushSubscriptionRepository {
  findByEndpoint(endpoint: string): Promise<PushSubscription | null>;
  findByAccountId(accountId: string): Promise<PushSubscription[]>;
  save(subscription: PushSubscription): Promise<void>;
  deleteByEndpoint(endpoint: string): Promise<void>;
}
