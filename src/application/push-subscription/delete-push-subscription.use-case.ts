import { PushSubscriptionValidationError } from '../../domain/push-subscription/push-subscription.errors';
import { PushSubscriptionRepository } from './ports/push-subscription.repository.port';

export interface DeletePushSubscriptionInput {
  accountId: string;
  endpoint: string;
}

export class DeletePushSubscriptionUseCase {
  constructor(private readonly pushSubscriptionRepository: PushSubscriptionRepository) {}

  async execute(input: DeletePushSubscriptionInput): Promise<void> {
    if (!input.accountId || typeof input.accountId !== 'string' || !input.accountId.trim()) {
      throw new PushSubscriptionValidationError('accountId is required');
    }
    const endpoint = typeof input.endpoint === 'string' ? input.endpoint.trim() : '';
    if (!endpoint) {
      throw new PushSubscriptionValidationError('endpoint is required');
    }

    const existing = await this.pushSubscriptionRepository.findByEndpoint(endpoint);
    if (!existing) {
      return;
    }

    // Only allow deletion if subscription belongs to the requesting account
    if (existing.accountId === input.accountId.trim()) {
      await this.pushSubscriptionRepository.deleteByEndpoint(endpoint);
    }
  }
}
