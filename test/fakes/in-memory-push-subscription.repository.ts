import { PushSubscriptionRepository } from '../../src/application/push-subscription/ports/push-subscription.repository.port';
import { PushSubscription } from '../../src/domain/push-subscription/push-subscription.entity';

export class InMemoryPushSubscriptionRepository implements PushSubscriptionRepository {
  private readonly store = new Map<string, PushSubscription>(); // key: endpoint

  async findByEndpoint(endpoint: string): Promise<PushSubscription | null> {
    const found = this.store.get(endpoint);
    if (!found) {
      return null;
    }
    return this.clone(found);
  }

  async findByAccountId(accountId: string): Promise<PushSubscription[]> {
    const list: PushSubscription[] = [];
    for (const sub of this.store.values()) {
      if (sub.accountId === accountId) {
        list.push(this.clone(sub));
      }
    }
    return list;
  }

  async save(subscription: PushSubscription): Promise<void> {
    this.store.set(subscription.endpoint, this.clone(subscription));
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    this.store.delete(endpoint);
  }

  clear(): void {
    this.store.clear();
  }

  getAll(): PushSubscription[] {
    return Array.from(this.store.values()).map((s) => this.clone(s));
  }

  private clone(subscription: PushSubscription): PushSubscription {
    return PushSubscription.reconstitute({
      id: subscription.id,
      accountId: subscription.accountId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    });
  }
}
