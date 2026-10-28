import { SyncableEntity } from '../shared/sync-idempotency';
import { Tone, isTone } from '../timetable/tone.vo';
import {
  CannotDeleteGeneratedSessionError,
  ClassSessionValidationError,
} from './class-session.errors';
import { PrepItem, validatePrepItems } from './prep-item.vo';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface CreateAdHocClassSessionProps {
  id: string;
  accountId: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  grade?: string | null;
  room?: string | null;
  tone: Tone;
  topic?: string | null;
  prepItems?: PrepItem[];
  cancelled?: boolean;
  now: Date;
}

export interface CreateOverrideClassSessionProps {
  id?: string;
  accountId: string;
  timetableSlotId: string;
  date: string;
  topic?: string | null;
  prepItems?: PrepItem[];
  cancelled?: boolean;
  now: Date;
}

export interface RehydrateClassSessionProps {
  id: string;
  accountId: string;
  timetableSlotId: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  subject: string | null;
  grade: string | null;
  room: string | null;
  tone: Tone | null;
  topic: string | null;
  prepItems: PrepItem[];
  cancelled: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface UpdateAdHocClassSessionProps {
  date?: string;
  startTime?: string;
  endTime?: string;
  subject?: string;
  grade?: string | null;
  room?: string | null;
  tone?: Tone;
  topic?: string | null;
  prepItems?: PrepItem[];
  cancelled?: boolean;
  now: Date;
}

export interface UpdateOverrideClassSessionProps {
  topic?: string | null;
  prepItems?: PrepItem[];
  cancelled?: boolean;
  now: Date;
}

export class ClassSession implements SyncableEntity {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _timetableSlotId: string | null,
    private _date: string,
    private _startTime: string | null,
    private _endTime: string | null,
    private _subject: string | null,
    private _grade: string | null,
    private _room: string | null,
    private _tone: Tone | null,
    private _topic: string | null,
    private _prepItems: PrepItem[],
    private _cancelled: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _deletedAt: Date | null,
  ) {}

  public static createAdHoc(props: CreateAdHocClassSessionProps): ClassSession {
    ClassSession.validateId(props.id);
    ClassSession.validateAccountId(props.accountId);
    ClassSession.validateDate(props.date);
    ClassSession.validateTimes(props.startTime, props.endTime);
    const validSubject = ClassSession.validateSubject(props.subject);
    const validGrade = ClassSession.normalizeOptionalString(props.grade);
    const validRoom = ClassSession.normalizeOptionalString(props.room);
    ClassSession.validateTone(props.tone);
    const validTopic = ClassSession.normalizeTopic(props.topic);
    const validPrepItems = props.prepItems ? validatePrepItems(props.prepItems) : [];

    return new ClassSession(
      props.id,
      props.accountId,
      null,
      props.date,
      props.startTime,
      props.endTime,
      validSubject,
      validGrade,
      validRoom,
      props.tone,
      validTopic,
      validPrepItems,
      props.cancelled ?? false,
      props.now,
      props.now,
      null,
    );
  }

  public static createOverride(props: CreateOverrideClassSessionProps): ClassSession {
    ClassSession.validateAccountId(props.accountId);
    ClassSession.validateDate(props.date);
    if (!props.timetableSlotId || !UUID_REGEX.test(props.timetableSlotId)) {
      throw new ClassSessionValidationError('timetableSlotId must be a valid UUID');
    }
    const id = props.id ?? `${props.timetableSlotId}:${props.date}`;
    const validTopic = ClassSession.normalizeTopic(props.topic);
    const validPrepItems = props.prepItems ? validatePrepItems(props.prepItems) : [];

    return new ClassSession(
      id,
      props.accountId,
      props.timetableSlotId,
      props.date,
      null,
      null,
      null,
      null,
      null,
      null,
      validTopic,
      validPrepItems,
      props.cancelled ?? false,
      props.now,
      props.now,
      null,
    );
  }

  public static rehydrate(props: RehydrateClassSessionProps): ClassSession {
    return new ClassSession(
      props.id,
      props.accountId,
      props.timetableSlotId,
      props.date,
      props.startTime,
      props.endTime,
      props.subject,
      props.grade,
      props.room,
      props.tone,
      props.topic,
      props.prepItems,
      props.cancelled,
      props.createdAt,
      props.updatedAt,
      props.deletedAt ?? null,
    );
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get timetableSlotId(): string | null {
    return this._timetableSlotId;
  }

  get date(): string {
    return this._date;
  }

  get startTime(): string | null {
    return this._startTime;
  }

  get endTime(): string | null {
    return this._endTime;
  }

  get subject(): string | null {
    return this._subject;
  }

  get grade(): string | null {
    return this._grade;
  }

  get room(): string | null {
    return this._room;
  }

  get tone(): Tone | null {
    return this._tone;
  }

  get topic(): string | null {
    return this._topic;
  }

  get prepItems(): PrepItem[] {
    return this._prepItems;
  }

  get cancelled(): boolean {
    return this._cancelled;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get deletedAt(): Date | null {
    return this._deletedAt;
  }

  isAdHoc(): boolean {
    return this._timetableSlotId === null;
  }

  isOverride(): boolean {
    return this._timetableSlotId !== null;
  }

  isDeleted(): boolean {
    return this._deletedAt !== null;
  }

  updateAdHoc(props: UpdateAdHocPropsInternal): void {
    if (this._timetableSlotId !== null) {
      throw new ClassSessionValidationError('Cannot update generated session with ad-hoc properties');
    }

    if (props.date !== undefined) {
      ClassSession.validateDate(props.date);
      this._date = props.date;
    }

    const newStart = props.startTime !== undefined ? props.startTime : this._startTime!;
    const newEnd = props.endTime !== undefined ? props.endTime : this._endTime!;
    if (props.startTime !== undefined || props.endTime !== undefined) {
      ClassSession.validateTimes(newStart, newEnd);
      this._startTime = newStart;
      this._endTime = newEnd;
    }

    if (props.subject !== undefined) {
      this._subject = ClassSession.validateSubject(props.subject);
    }

    if (props.grade !== undefined) {
      this._grade = ClassSession.normalizeOptionalString(props.grade);
    }

    if (props.room !== undefined) {
      this._room = ClassSession.normalizeOptionalString(props.room);
    }

    if (props.tone !== undefined) {
      ClassSession.validateTone(props.tone);
      this._tone = props.tone;
    }

    if (props.topic !== undefined) {
      this._topic = ClassSession.normalizeTopic(props.topic);
    }

    if (props.prepItems !== undefined) {
      this._prepItems = validatePrepItems(props.prepItems);
    }

    if (props.cancelled !== undefined) {
      this._cancelled = props.cancelled;
    }

    this._updatedAt = props.now;
  }

  updateOverride(props: UpdateOverrideClassSessionProps): void {
    if (this._timetableSlotId === null) {
      throw new ClassSessionValidationError('Cannot update ad-hoc session as override');
    }

    if (props.topic !== undefined) {
      this._topic = ClassSession.normalizeTopic(props.topic);
    }

    if (props.prepItems !== undefined) {
      this._prepItems = validatePrepItems(props.prepItems);
    }

    if (props.cancelled !== undefined) {
      this._cancelled = props.cancelled;
    }

    this._updatedAt = props.now;
  }

  matchesAdHocPayload(payload: {
    date: string;
    startTime: string;
    endTime: string;
    subject: string;
    grade?: string | null;
    room?: string | null;
    tone: Tone;
    topic?: string | null;
    prepItems?: PrepItem[];
    cancelled?: boolean;
  }): boolean {
    if (!this.isAdHoc()) {
      return false;
    }

    const normGrade = payload.grade ? payload.grade.trim() : null;
    const normRoom = payload.room ? payload.room.trim() : null;
    const normSubject = payload.subject?.trim() ?? '';
    const normTopic = payload.topic ? payload.topic.trim() : null;
    const normCancelled = payload.cancelled ?? false;
    const payloadItems = payload.prepItems ?? [];

    const itemsMatch =
      this._prepItems.length === payloadItems.length &&
      this._prepItems.every(
        (item, idx) =>
          item.id === payloadItems[idx].id &&
          item.label === payloadItems[idx].label &&
          item.done === payloadItems[idx].done,
      );

    return (
      this._date === payload.date &&
      this._startTime === payload.startTime &&
      this._endTime === payload.endTime &&
      this._subject === normSubject &&
      this._grade === normGrade &&
      this._room === normRoom &&
      this._tone === payload.tone &&
      this._topic === normTopic &&
      this._cancelled === normCancelled &&
      itemsMatch
    );
  }

  delete(now: Date): void {
    if (this._timetableSlotId !== null) {
      throw new CannotDeleteGeneratedSessionError('Cannot delete a generated class session');
    }
    this._deletedAt = now;
    this._updatedAt = now;
  }

  private static validateId(id: string): void {
    if (!id || typeof id !== 'string' || !UUID_REGEX.test(id)) {
      throw new ClassSessionValidationError('Class session id must be a valid UUID');
    }
  }

  private static validateAccountId(accountId: string): void {
    if (!accountId || typeof accountId !== 'string' || accountId.trim().length === 0) {
      throw new ClassSessionValidationError('accountId cannot be empty');
    }
  }

  private static validateDate(date: string): void {
    if (!date || typeof date !== 'string' || !DATE_REGEX.test(date)) {
      throw new ClassSessionValidationError('date must be in YYYY-MM-DD format');
    }
  }

  private static validateTimes(startTime: string, endTime: string): void {
    if (!startTime || !TIME_REGEX.test(startTime)) {
      throw new ClassSessionValidationError('startTime must be in HH:mm format');
    }
    if (!endTime || !TIME_REGEX.test(endTime)) {
      throw new ClassSessionValidationError('endTime must be in HH:mm format');
    }
    if (startTime >= endTime) {
      throw new ClassSessionValidationError('startTime must be strictly before endTime');
    }
  }

  private static validateSubject(subject: string): string {
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      throw new ClassSessionValidationError('subject cannot be empty');
    }
    const trimmed = subject.trim();
    if (trimmed.length > 120) {
      throw new ClassSessionValidationError('subject cannot exceed 120 characters');
    }
    return trimmed;
  }

  private static normalizeOptionalString(val?: string | null): string | null {
    if (!val || typeof val !== 'string') {
      return null;
    }
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private static normalizeTopic(topic?: string | null): string | null {
    if (!topic || typeof topic !== 'string') {
      return null;
    }
    const trimmed = topic.trim();
    if (trimmed.length === 0) {
      return null;
    }
    if (trimmed.length > 500) {
      throw new ClassSessionValidationError('topic cannot exceed 500 characters');
    }
    return trimmed;
  }

  private static validateTone(tone: unknown): asserts tone is Tone {
    if (!isTone(tone)) {
      throw new ClassSessionValidationError(
        'tone must be one of pink, blue, beige, lavender, rose, mint',
      );
    }
  }
}

type UpdateAdHocPropsInternal = UpdateAdHocClassSessionProps;
