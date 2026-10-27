import { PushSubscription as PrismaPushSubscription } from '@prisma/client';
import { PushSubscription } from '../../../../domain/push-subscription/push-subscription.entity';

export class PushSubscriptionMapper {
  static toDomain(raw: PrismaPushSubscription): PushSubscription {
    return PushSubscription.reconstitute({
      id: raw.id,
      accountId: raw.accountId,
      endpoint: raw.endpoint,
      keys: {
        p256dh: raw.p256dh,
        auth: raw.auth,
      },
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  static toPrismaCreate(sub: PushSubscription) {
    return {
      id: sub.id,
      accountId: sub.accountId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    };
  }

  static toPrismaUpdate(sub: PushSubscription) {
    return {
      accountId: sub.accountId,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      updatedAt: sub.updatedAt,
    };
  }
}
