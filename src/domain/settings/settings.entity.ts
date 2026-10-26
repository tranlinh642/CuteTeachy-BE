import {
  isReminderLeadMinutes,
  isSettingsLocale,
  isValidIanaTimeZone,
  ReminderLeadMinutes,
  SettingsLocale,
} from './settings.types';
import { SettingsValidationError } from './settings.errors';

export interface SettingsProps {
  id?: string;
  accountId: string;
  locale: SettingsLocale;
  timeZone: string;
  pushEnabled: boolean;
  reminderLeadMinutes: ReminderLeadMinutes;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDefaultSettingsOptions {
  id?: string;
  locale?: SettingsLocale;
  timeZone?: string;
  pushEnabled?: boolean;
  reminderLeadMinutes?: ReminderLeadMinutes;
  now?: Date;
}

export interface UpdateSettingsProps {
  locale?: SettingsLocale;
  timeZone?: string;
  pushEnabled?: boolean;
  reminderLeadMinutes?: ReminderLeadMinutes;
}

export class Settings {
  private constructor(private readonly props: SettingsProps) {}

  public static createDefault(
    accountId: string,
    options?: CreateDefaultSettingsOptions,
  ): Settings {
    if (!accountId || typeof accountId !== 'string' || !accountId.trim()) {
      throw new SettingsValidationError('accountId is required');
    }

    const locale = options?.locale ?? 'vi';
    if (!isSettingsLocale(locale)) {
      throw new SettingsValidationError(`Invalid locale: ${locale}`);
    }

    const timeZone = options?.timeZone ?? 'Asia/Ho_Chi_Minh';
    if (!isValidIanaTimeZone(timeZone)) {
      throw new SettingsValidationError(`Invalid IANA time zone: ${timeZone}`);
    }

    const pushEnabled = options?.pushEnabled ?? true;
    const reminderLeadMinutes = options?.reminderLeadMinutes ?? 15;
    if (!isReminderLeadMinutes(reminderLeadMinutes)) {
      throw new SettingsValidationError(`Invalid reminderLeadMinutes: ${reminderLeadMinutes}`);
    }

    const now = options?.now ?? new Date();

    return new Settings({
      id: options?.id,
      accountId: accountId.trim(),
      locale,
      timeZone,
      pushEnabled,
      reminderLeadMinutes,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: SettingsProps): Settings {
    return new Settings({ ...props });
  }

  public update(props: UpdateSettingsProps, now = new Date()): void {
    let modified = false;

    if (props.locale !== undefined) {
      if (!isSettingsLocale(props.locale)) {
        throw new SettingsValidationError(`Invalid locale: ${props.locale}`);
      }
      this.props.locale = props.locale;
      modified = true;
    }

    if (props.timeZone !== undefined) {
      if (!isValidIanaTimeZone(props.timeZone)) {
        throw new SettingsValidationError(`Invalid IANA time zone: ${props.timeZone}`);
      }
      this.props.timeZone = props.timeZone;
      modified = true;
    }

    if (props.pushEnabled !== undefined) {
      if (typeof props.pushEnabled !== 'boolean') {
        throw new SettingsValidationError('pushEnabled must be a boolean');
      }
      this.props.pushEnabled = props.pushEnabled;
      modified = true;
    }

    if (props.reminderLeadMinutes !== undefined) {
      if (!isReminderLeadMinutes(props.reminderLeadMinutes)) {
        throw new SettingsValidationError(
          `Invalid reminderLeadMinutes: ${props.reminderLeadMinutes}`,
        );
      }
      this.props.reminderLeadMinutes = props.reminderLeadMinutes;
      modified = true;
    }

    if (modified) {
      this.props.updatedAt = now;
    }
  }

  get id(): string | undefined {
    return this.props.id;
  }

  get accountId(): string {
    return this.props.accountId;
  }

  get locale(): SettingsLocale {
    return this.props.locale;
  }

  get timeZone(): string {
    return this.props.timeZone;
  }

  get pushEnabled(): boolean {
    return this.props.pushEnabled;
  }

  get reminderLeadMinutes(): ReminderLeadMinutes {
    return this.props.reminderLeadMinutes;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
