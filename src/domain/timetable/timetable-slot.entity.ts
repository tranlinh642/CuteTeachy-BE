import { SyncableEntity } from '../shared/sync-idempotency';
import { Tone, isTone } from './tone.vo';
import { TimetableValidationError } from './timetable.errors';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface CreateTimetableSlotProps {
  id: string;
  accountId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  subject: string;
  grade?: string | null;
  room?: string | null;
  tone: Tone;
  effectiveFrom: string;
  effectiveTo?: string | null;
  now: Date;
}

export interface RehydrateTimetableSlotProps {
  id: string;
  accountId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  subject: string;
  grade?: string | null;
  room?: string | null;
  tone: Tone;
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface UpdateTimetableSlotProps {
  weekday?: number;
  startTime?: string;
  endTime?: string;
  subject?: string;
  grade?: string | null;
  room?: string | null;
  tone?: Tone;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  now: Date;
}

export class TimetableSlot implements SyncableEntity {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private _weekday: number,
    private _startTime: string,
    private _endTime: string,
    private _subject: string,
    private _grade: string | null,
    private _room: string | null,
    private _tone: Tone,
    private _effectiveFrom: string,
    private _effectiveTo: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _deletedAt: Date | null,
  ) {}

  public static create(props: CreateTimetableSlotProps): TimetableSlot {
    TimetableSlot.validateId(props.id);
    TimetableSlot.validateAccountId(props.accountId);
    TimetableSlot.validateWeekday(props.weekday);
    TimetableSlot.validateTimes(props.startTime, props.endTime);
    const validSubject = TimetableSlot.validateSubject(props.subject);
    const validGrade = TimetableSlot.normalizeOptionalString(props.grade);
    const validRoom = TimetableSlot.normalizeOptionalString(props.room);
    TimetableSlot.validateTone(props.tone);
    TimetableSlot.validateEffectiveDates(props.effectiveFrom, props.effectiveTo);

    return new TimetableSlot(
      props.id,
      props.accountId,
      props.weekday,
      props.startTime,
      props.endTime,
      validSubject,
      validGrade,
      validRoom,
      props.tone,
      props.effectiveFrom,
      props.effectiveTo ? props.effectiveTo : null,
      props.now,
      props.now,
      null,
    );
  }

  public static rehydrate(props: RehydrateTimetableSlotProps): TimetableSlot {
    return new TimetableSlot(
      props.id,
      props.accountId,
      props.weekday,
      props.startTime,
      props.endTime,
      props.subject,
      props.grade ?? null,
      props.room ?? null,
      props.tone,
      props.effectiveFrom,
      props.effectiveTo ?? null,
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

  get weekday(): number {
    return this._weekday;
  }

  get startTime(): string {
    return this._startTime;
  }

  get endTime(): string {
    return this._endTime;
  }

  get subject(): string {
    return this._subject;
  }

  get grade(): string | null {
    return this._grade;
  }

  get room(): string | null {
    return this._room;
  }

  get tone(): Tone {
    return this._tone;
  }

  get effectiveFrom(): string {
    return this._effectiveFrom;
  }

  get effectiveTo(): string | null {
    return this._effectiveTo;
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

  isDeleted(): boolean {
    return this._deletedAt !== null;
  }

  hasPastSessions(today: string): boolean {
    return this._effectiveFrom < today;
  }

  endAt(yesterday: string, now: Date): void {
    TimetableSlot.assertValidCalendarDate(yesterday, 'effectiveTo');
    this._effectiveTo = yesterday;
    this._updatedAt = now;
  }

  delete(now: Date): void {
    this._deletedAt = now;
    this._updatedAt = now;
  }

  update(props: UpdateTimetableSlotProps): void {
    const newWeekday = props.weekday ?? this._weekday;
    const newStartTime = props.startTime ?? this._startTime;
    const newEndTime = props.endTime ?? this._endTime;
    const newSubject = props.subject !== undefined ? props.subject : this._subject;
    const newGrade = props.grade !== undefined ? props.grade : this._grade;
    const newRoom = props.room !== undefined ? props.room : this._room;
    const newTone = props.tone ?? this._tone;
    const newEffectiveFrom = props.effectiveFrom ?? this._effectiveFrom;
    const newEffectiveTo =
      props.effectiveTo !== undefined ? props.effectiveTo : this._effectiveTo;

    TimetableSlot.validateWeekday(newWeekday);
    TimetableSlot.validateTimes(newStartTime, newEndTime);
    const validSubject = TimetableSlot.validateSubject(newSubject);
    const validGrade = TimetableSlot.normalizeOptionalString(newGrade);
    const validRoom = TimetableSlot.normalizeOptionalString(newRoom);
    TimetableSlot.validateTone(newTone);
    TimetableSlot.validateEffectiveDates(newEffectiveFrom, newEffectiveTo);

    this._weekday = newWeekday;
    this._startTime = newStartTime;
    this._endTime = newEndTime;
    this._subject = validSubject;
    this._grade = validGrade;
    this._room = validRoom;
    this._tone = newTone;
    this._effectiveFrom = newEffectiveFrom;
    this._effectiveTo = newEffectiveTo ? newEffectiveTo : null;
    this._updatedAt = props.now;
  }

  matchesPayload(payload: {
    weekday: number;
    startTime: string;
    endTime: string;
    subject: string;
    grade?: string | null;
    room?: string | null;
    tone: Tone;
    effectiveFrom: string;
    effectiveTo?: string | null;
  }): boolean {
    const normGrade = TimetableSlot.normalizeOptionalString(payload.grade);
    const normRoom = TimetableSlot.normalizeOptionalString(payload.room);
    const normSubject = payload.subject?.trim() ?? '';
    const normEffTo = payload.effectiveTo ? payload.effectiveTo : null;

    return (
      this._weekday === payload.weekday &&
      this._startTime === payload.startTime &&
      this._endTime === payload.endTime &&
      this._subject === normSubject &&
      this._grade === normGrade &&
      this._room === normRoom &&
      this._tone === payload.tone &&
      this._effectiveFrom === payload.effectiveFrom &&
      this._effectiveTo === normEffTo
    );
  }

  conflictsWith(other: {
    weekday: number;
    startTime: string;
    endTime: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
  }): boolean {
    if (this._weekday !== other.weekday) {
      return false;
    }

    // Time interval overlap: startTime < other.endTime && endTime > other.startTime
    // Touching edges (e.g. 07:45 vs 07:45) is NOT an overlap.
    const timeOverlap = this._startTime < other.endTime && this._endTime > other.startTime;
    if (!timeOverlap) {
      return false;
    }

    // Date range overlap:
    // [from1, to1 ?? infinity] overlaps [from2, to2 ?? infinity] if:
    // from1 <= to2 && from2 <= to1
    const thisTo = this._effectiveTo ?? '9999-12-31';
    const otherTo = other.effectiveTo ?? '9999-12-31';
    const dateOverlap = this._effectiveFrom <= otherTo && other.effectiveFrom <= thisTo;

    return dateOverlap;
  }

  private static validateId(id: string): void {
    if (!id || typeof id !== 'string' || !UUID_REGEX.test(id)) {
      throw new TimetableValidationError('Slot id must be a valid UUID');
    }
  }

  private static validateAccountId(accountId: string): void {
    if (!accountId || typeof accountId !== 'string' || accountId.trim() === '') {
      throw new TimetableValidationError('accountId is required');
    }
  }

  private static validateWeekday(weekday: number): void {
    if (
      typeof weekday !== 'number' ||
      !Number.isInteger(weekday) ||
      weekday < 1 ||
      weekday > 7
    ) {
      throw new TimetableValidationError('weekday must be an integer between 1 and 7');
    }
  }

  private static validateTimes(startTime: string, endTime: string): void {
    if (!startTime || typeof startTime !== 'string' || !TIME_REGEX.test(startTime)) {
      throw new TimetableValidationError('startTime must be in HH:mm format');
    }
    if (!endTime || typeof endTime !== 'string' || !TIME_REGEX.test(endTime)) {
      throw new TimetableValidationError('endTime must be in HH:mm format');
    }
    if (startTime >= endTime) {
      throw new TimetableValidationError('startTime must be before endTime on the same day');
    }
  }

  private static validateSubject(subject: string): string {
    if (!subject || typeof subject !== 'string') {
      throw new TimetableValidationError('subject is required');
    }
    const trimmed = subject.trim();
    if (trimmed.length < 1 || trimmed.length > 120) {
      throw new TimetableValidationError('subject must be between 1 and 120 characters');
    }
    return trimmed;
  }

  private static normalizeOptionalString(val?: string | null): string | null {
    if (val === undefined || val === null) {
      return null;
    }
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private static validateTone(tone: unknown): void {
    if (!isTone(tone)) {
      throw new TimetableValidationError(
        'tone must be one of pink, blue, beige, lavender, rose, mint',
      );
    }
  }

  private static validateEffectiveDates(from: string, to?: string | null): void {
    if (!from || typeof from !== 'string' || !DATE_REGEX.test(from)) {
      throw new TimetableValidationError('effectiveFrom must be in YYYY-MM-DD format');
    }
    TimetableSlot.assertValidCalendarDate(from, 'effectiveFrom');

    if (to !== undefined && to !== null && to !== '') {
      if (typeof to !== 'string' || !DATE_REGEX.test(to)) {
        throw new TimetableValidationError('effectiveTo must be in YYYY-MM-DD format');
      }
      TimetableSlot.assertValidCalendarDate(to, 'effectiveTo');

      if (to < from) {
        throw new TimetableValidationError('effectiveTo must be greater than or equal to effectiveFrom');
      }
    }
  }

  private static assertValidCalendarDate(dateStr: string, fieldName: string): void {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (
      date.getUTCFullYear() !== y ||
      date.getUTCMonth() !== m - 1 ||
      date.getUTCDate() !== d
    ) {
      throw new TimetableValidationError(`${fieldName} is not a valid calendar date`);
    }
  }
}
