import {
  InAppNotificationType,
  isInAppNotificationType,
} from './in-app-notification-type.vo';
import { NotificationValidationError } from './notification.errors';

export interface CreateInAppNotificationProps {
  id: string;
  accountId: string;
  type: InAppNotificationType;
  targetId?: string | null;
  title: string;
  body: string;
  url: string;
  data?: Record<string, unknown> | null;
  now: Date;
}

export interface ReconstituteInAppNotificationProps {
  id: string;
  accountId: string;
  type: InAppNotificationType;
  targetId: string | null;
  title: string;
  body: string;
  url: string;
  data: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
}

export class InAppNotification {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _type: InAppNotificationType,
    private readonly _targetId: string | null,
    private readonly _title: string,
    private readonly _body: string,
    private readonly _url: string,
    private readonly _data: Record<string, unknown> | null,
    private _readAt: Date | null,
    private readonly _createdAt: Date,
  ) {}

  static create(props: CreateInAppNotificationProps): InAppNotification {
    if (!props.id || typeof props.id !== 'string' || !props.id.trim()) {
      throw new NotificationValidationError('id is required and cannot be empty');
    }

    if (!props.accountId || typeof props.accountId !== 'string' || !props.accountId.trim()) {
      throw new NotificationValidationError('accountId is required and cannot be empty');
    }

    if (!isInAppNotificationType(props.type)) {
      throw new NotificationValidationError(`Invalid notification type: ${String(props.type)}`);
    }

    if (!props.title || typeof props.title !== 'string' || !props.title.trim()) {
      throw new NotificationValidationError('title is required and cannot be empty');
    }

    if (!props.body || typeof props.body !== 'string' || !props.body.trim()) {
      throw new NotificationValidationError('body is required and cannot be empty');
    }

    if (!props.url || typeof props.url !== 'string' || !props.url.trim()) {
      throw new NotificationValidationError('url is required and cannot be empty');
    }

    if (!props.now || !(props.now instanceof Date) || isNaN(props.now.getTime())) {
      throw new NotificationValidationError('now must be a valid Date');
    }

    const targetId =
      props.targetId && typeof props.targetId === 'string' && props.targetId.trim()
        ? props.targetId.trim()
        : null;

    const data =
      props.data && typeof props.data === 'object' ? { ...props.data } : null;

    return new InAppNotification(
      props.id.trim(),
      props.accountId.trim(),
      props.type,
      targetId,
      props.title.trim(),
      props.body.trim(),
      props.url.trim(),
      data,
      null,
      new Date(props.now.getTime()),
    );
  }

  static reconstitute(props: ReconstituteInAppNotificationProps): InAppNotification {
    return new InAppNotification(
      props.id,
      props.accountId,
      props.type,
      props.targetId ?? null,
      props.title,
      props.body,
      props.url,
      props.data ? { ...props.data } : null,
      props.readAt ? new Date(props.readAt.getTime()) : null,
      new Date(props.createdAt.getTime()),
    );
  }

  markRead(now: Date): void {
    if (!now || !(now instanceof Date) || isNaN(now.getTime())) {
      throw new NotificationValidationError('now must be a valid Date');
    }
    if (this._readAt === null) {
      this._readAt = new Date(now.getTime());
    }
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get type(): InAppNotificationType {
    return this._type;
  }

  get targetId(): string | null {
    return this._targetId;
  }

  get title(): string {
    return this._title;
  }

  get body(): string {
    return this._body;
  }

  get url(): string {
    return this._url;
  }

  get data(): Record<string, unknown> | null {
    return this._data ? { ...this._data } : null;
  }

  get readAt(): Date | null {
    return this._readAt ? new Date(this._readAt.getTime()) : null;
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }
}
