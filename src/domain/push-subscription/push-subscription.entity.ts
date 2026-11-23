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

  private static validateEndpoint(endpoint: string): void {
    if (!endpoint) {
      throw new PushSubscriptionValidationError('endpoint is required');
    }

    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new PushSubscriptionValidationError('endpoint must be a valid HTTPS URL');
    }

    if (url.protocol !== 'https:') {
      throw new PushSubscriptionValidationError('endpoint must use https protocol');
    }

    if (url.username || url.password) {
      throw new PushSubscriptionValidationError('endpoint must not contain credentials');
    }

    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      !hostname ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('::ffff:') ||
      /^f[cd][0-9a-f]{0,2}:/i.test(hostname) ||
      hostname.startsWith('fe80:')
    ) {
      throw new PushSubscriptionValidationError('endpoint hostname is not allowed');
    }

    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const octets = ipv4Match.slice(1, 5).map(Number);
      if (octets.some((o) => o < 0 || o > 255)) {
        throw new PushSubscriptionValidationError('endpoint hostname is not allowed');
      }
      const [a, b] = octets;
      if (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
      ) {
        throw new PushSubscriptionValidationError('endpoint hostname is not allowed');
      }
    }
  }

  static create(props: CreatePushSubscriptionProps): PushSubscription {
    if (!props.id || typeof props.id !== 'string' || !props.id.trim()) {
      throw new PushSubscriptionValidationError('Subscription id is required');
    }
    if (!props.accountId || typeof props.accountId !== 'string' || !props.accountId.trim()) {
      throw new PushSubscriptionValidationError('accountId is required');
    }
    const endpoint = typeof props.endpoint === 'string' ? props.endpoint.trim() : '';
    PushSubscription.validateEndpoint(endpoint);

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
