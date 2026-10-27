import { PushSubscriptionValidationError } from './push-subscription.errors';
import { PushSubscriptionKeys, PushSubscriptionKeysProps } from './push-subscription.vo';

export interface CreatePushSubscriptionProps {
  id: string;
  accountId: string;
  endpoint: string;
  keys: PushSubscriptionKeysProps | PushSubscriptionKeys;
  now: Date;
}

export interface ReconstitutePushSubscriptionProps {
  id: string;
  accountId: string;
  endpoint: string;
  keys: PushSubscriptionKeysProps | PushSubscriptionKeys;
  createdAt: Date;
  updatedAt: Date;
}

export class PushSubscription {
  private constructor(
    private readonly _id: string,
    private _accountId: string,
    private readonly _endpoint: string,
    private _keys: PushSubscriptionKeys,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(props: CreatePushSubscriptionProps): PushSubscription {
    if (!props.id || typeof props.id !== 'string' || !props.id.trim()) {
      throw new PushSubscriptionValidationError('Subscription id is required');
    }
    if (!props.accountId || typeof props.accountId !== 'string' || !props.accountId.trim()) {
      throw new PushSubscriptionValidationError('accountId is required');
    }
    const endpoint = typeof props.endpoint === 'string' ? props.endpoint.trim() : '';
    if (!endpoint) {
      throw new PushSubscriptionValidationError('endpoint is required');
    }
    if (!(props.now instanceof Date) || isNaN(props.now.getTime())) {
      throw new PushSubscriptionValidationError('now is required and must be a valid Date');
    }

    const keys =
      props.keys instanceof PushSubscriptionKeys
        ? props.keys
        : PushSubscriptionKeys.create(props.keys);

    return new PushSubscription(
      props.id.trim(),
      props.accountId.trim(),
      endpoint,
      keys,
      props.now,
      props.now,
    );
  }

  static reconstitute(props: ReconstitutePushSubscriptionProps): PushSubscription {
    const keys =
      props.keys instanceof PushSubscriptionKeys
        ? props.keys
        : PushSubscriptionKeys.create(props.keys);

    return new PushSubscription(
      props.id,
      props.accountId,
      props.endpoint,
      keys,
      props.createdAt,
      props.updatedAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get endpoint(): string {
    return this._endpoint;
  }

  get keys(): PushSubscriptionKeys {
    return this._keys;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  reassignToAccount(
    newAccountId: string,
    newKeys: PushSubscriptionKeysProps | PushSubscriptionKeys,
    now: Date,
  ): void {
    if (!newAccountId || typeof newAccountId !== 'string' || !newAccountId.trim()) {
      throw new PushSubscriptionValidationError('accountId is required');
    }
    if (!(now instanceof Date) || isNaN(now.getTime())) {
      throw new PushSubscriptionValidationError('now is required and must be a valid Date');
    }
    this._accountId = newAccountId.trim();
    this._keys =
      newKeys instanceof PushSubscriptionKeys ? newKeys : PushSubscriptionKeys.create(newKeys);
    this._updatedAt = now;
  }

  updateKeys(newKeys: PushSubscriptionKeysProps | PushSubscriptionKeys, now: Date): void {
    if (!(now instanceof Date) || isNaN(now.getTime())) {
      throw new PushSubscriptionValidationError('now is required and must be a valid Date');
    }
    this._keys =
      newKeys instanceof PushSubscriptionKeys ? newKeys : PushSubscriptionKeys.create(newKeys);
    this._updatedAt = now;
  }
}
