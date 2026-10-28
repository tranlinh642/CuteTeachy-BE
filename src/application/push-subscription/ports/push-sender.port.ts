import { PushPayload } from '../push-subscription.dto';

export const PUSH_SENDER = Symbol('PUSH_SENDER');

export interface PushSubscriptionTarget {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class PushSubscriptionExpiredError extends Error {
  constructor(
    public readonly endpoint: string,
    message = 'Push subscription has expired or is unsubscribed (404/410)',
  ) {
    super(message);
    this.name = 'PushSubscriptionExpiredError';
  }
}

export interface PushSender {
  getVapidPublicKey(): string;
  send(target: PushSubscriptionTarget, payload: PushPayload): Promise<void>;
}
