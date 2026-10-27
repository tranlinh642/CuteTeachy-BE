import { ReminderType, isReminderType } from './reminder-type.vo';
import { ReminderValidationError } from './reminder.errors';

export interface CreateSentReminderProps {
  id?: string;
  type: ReminderType;
  targetId: string;
  remindAt: Date;
  accountId: string;
  now: Date;
}

export interface ReconstituteSentReminderProps {
  id: string;
  type: ReminderType;
  targetId: string;
  remindAt: Date;
  sentAt: Date;
  accountId: string;
}

export class SentReminder {
  private constructor(
    private readonly _id: string,
    private readonly _type: ReminderType,
    private readonly _targetId: string,
    private readonly _remindAt: Date,
    private readonly _sentAt: Date,
    private readonly _accountId: string,
  ) {}

  static create(props: CreateSentReminderProps): SentReminder {
    if (!isReminderType(props.type)) {
      throw new ReminderValidationError(`Invalid reminder type: ${props.type}`);
    }

    if (!props.targetId || typeof props.targetId !== 'string' || !props.targetId.trim()) {
      throw new ReminderValidationError('targetId is required and cannot be empty');
    }

    if (!props.accountId || typeof props.accountId !== 'string' || !props.accountId.trim()) {
      throw new ReminderValidationError('accountId is required and cannot be empty');
    }

    if (!props.remindAt || !(props.remindAt instanceof Date) || isNaN(props.remindAt.getTime())) {
      throw new ReminderValidationError('remindAt must be a valid Date');
    }

    if (!props.now || !(props.now instanceof Date) || isNaN(props.now.getTime())) {
      throw new ReminderValidationError('now must be a valid Date');
    }

    const id = props.id ?? crypto.randomUUID();

    return new SentReminder(
      id,
      props.type,
      props.targetId.trim(),
      new Date(props.remindAt.getTime()),
      new Date(props.now.getTime()),
      props.accountId.trim(),
    );
  }

  static reconstitute(props: ReconstituteSentReminderProps): SentReminder {
    return new SentReminder(
      props.id,
      props.type,
      props.targetId,
      new Date(props.remindAt.getTime()),
      new Date(props.sentAt.getTime()),
      props.accountId,
    );
  }

  get id(): string {
    return this._id;
  }

  get type(): ReminderType {
    return this._type;
  }

  get targetId(): string {
    return this._targetId;
  }

  get remindAt(): Date {
    return new Date(this._remindAt.getTime());
  }

  get sentAt(): Date {
    return new Date(this._sentAt.getTime());
  }

  get accountId(): string {
    return this._accountId;
  }
}
