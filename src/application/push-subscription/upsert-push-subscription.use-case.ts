import { PushSubscription } from '../../domain/push-subscription/push-subscription.entity';
import { PushSubscriptionValidationError } from '../../domain/push-subscription/push-subscription.errors';
import { Clock } from '../shared/ports/clock.port';
import { IdGenerator } from '../shared/ports/id-generator.port';
import { PushSubscriptionRepository } from './ports/push-subscription.repository.port';
import { PushSubscriptionDto } from './push-subscription.dto';

export interface UpsertPushSubscriptionInput {
  accountId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface UpsertPushSubscriptionOutput {
  subscription: PushSubscriptionDto;
  created: boolean;
}

export class UpsertPushSubscriptionUseCase {
  constructor(
    private readonly pushSubscriptionRepository: PushSubscriptionRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(input: UpsertPushSubscriptionInput): Promise<UpsertPushSubscriptionOutput> {
    if (!input.accountId || typeof input.accountId !== 'string' || !input.accountId.trim()) {
      throw new PushSubscriptionValidationError('accountId is required');
    }
    const endpoint = typeof input.endpoint === 'string' ? input.endpoint.trim() : '';
    if (!endpoint) {
      throw new PushSubscriptionValidationError('endpoint is required');
    }
    if (!input.keys || typeof input.keys !== 'object') {
      throw new PushSubscriptionValidationError('keys is required');
    }

    const now = this.clock.now();
    const existing = await this.pushSubscriptionRepository.findByEndpoint(endpoint);

    if (!existing) {
      const subscription = PushSubscription.create({
        id: this.idGenerator.next(),
        accountId: input.accountId.trim(),
        endpoint,
        keys: input.keys,
        now,
      });

      await this.pushSubscriptionRepository.save(subscription);

      return {
        subscription: this.toDto(subscription),
        created: true,
      };
    }

    // Existing subscription: reassign to current account if belongs to another, or update keys
    if (existing.accountId !== input.accountId.trim()) {
      existing.reassignToAccount(input.accountId.trim(), input.keys, now);
    } else {
      existing.updateKeys(input.keys, now);
    }

    await this.pushSubscriptionRepository.save(existing);

    return {
      subscription: this.toDto(existing),
      created: false,
    };
  }

  private toDto(subscription: PushSubscription): PushSubscriptionDto {
    return {
      id: subscription.id,
      accountId: subscription.accountId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    };
  }
}
