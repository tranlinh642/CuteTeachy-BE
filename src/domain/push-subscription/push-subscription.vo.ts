import { PushSubscriptionValidationError } from './push-subscription.errors';

export interface PushSubscriptionKeysProps {
  p256dh: string;
  auth: string;
}

export class PushSubscriptionKeys {
  private constructor(
    private readonly _p256dh: string,
    private readonly _auth: string,
  ) {}

  static create(props: PushSubscriptionKeysProps): PushSubscriptionKeys {
    if (!props || typeof props !== 'object') {
      throw new PushSubscriptionValidationError('Push subscription keys are required');
    }
    const p256dh = typeof props.p256dh === 'string' ? props.p256dh.trim() : '';
    const auth = typeof props.auth === 'string' ? props.auth.trim() : '';

    if (!p256dh) {
      throw new PushSubscriptionValidationError('keys.p256dh is required and cannot be empty');
    }
    if (!auth) {
      throw new PushSubscriptionValidationError('keys.auth is required and cannot be empty');
    }

    return new PushSubscriptionKeys(p256dh, auth);
  }

  get p256dh(): string {
    return this._p256dh;
  }

  get auth(): string {
    return this._auth;
  }

  toJSON(): PushSubscriptionKeysProps {
    return {
      p256dh: this._p256dh,
      auth: this._auth,
    };
  }
}
