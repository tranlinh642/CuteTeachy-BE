import { PushSubscriptionValidationError } from '../../domain/push-subscription/push-subscription.errors';
import { PushSender, PushSubscriptionExpiredError } from './ports/push-sender.port';
import { PushSubscriptionRepository } from './ports/push-subscription.repository.port';
import { PushPayload } from './push-subscription.dto';

export interface SendPushToTeacherInput {
  accountId: string;
  payload: PushPayload;
}

export interface SendPushToTeacherOutput {
  total: number;
  sent: number;
  expired: number;
  failed: number;
}

export class SendPushToTeacherUseCase {
  constructor(
    private readonly pushSubscriptionRepository: PushSubscriptionRepository,
    private readonly pushSender: PushSender,
  ) {}

  async execute(input: SendPushToTeacherInput): Promise<SendPushToTeacherOutput> {
    if (!input.accountId || typeof input.accountId !== 'string' || !input.accountId.trim()) {
      throw new PushSubscriptionValidationError('accountId is required');
    }
    if (!input.payload || !input.payload.title || !input.payload.body) {
      throw new PushSubscriptionValidationError('payload title and body are required');
    }

    const subscriptions = await this.pushSubscriptionRepository.findByAccountId(
      input.accountId.trim(),
    );

    if (subscriptions.length === 0) {
      return { total: 0, sent: 0, expired: 0, failed: 0 };
    }

    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await this.pushSender.send(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth,
              },
            },
            input.payload,
          );
          return 'sent' as const;
        } catch (error: any) {
          const isExpired =
            error instanceof PushSubscriptionExpiredError ||
            error?.statusCode === 404 ||
            error?.statusCode === 410;

          if (isExpired) {
            await this.pushSubscriptionRepository.deleteByEndpoint(sub.endpoint);
            return 'expired' as const;
          }

          return 'failed' as const;
        }
      }),
    );

    const sent = results.filter((r) => r === 'sent').length;
    const expired = results.filter((r) => r === 'expired').length;
    const failed = results.filter((r) => r === 'failed').length;

    return {
      total: subscriptions.length,
      sent,
      expired,
      failed,
    };
  }
}
