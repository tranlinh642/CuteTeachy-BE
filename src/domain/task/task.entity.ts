import { SyncableEntity } from '../shared/sync-idempotency';
import { TaskCategory, isTaskCategory } from './task-category.vo';
import { TaskPriority, isTaskPriority } from './task-priority.vo';
import { TaskValidationError } from './task.errors';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export interface CreateTaskProps {
  id: string;
  accountId: string;
  title: string;
  notes?: string | null;
  date: string;
  time?: string | null;
  category: TaskCategory;
  priority?: TaskPriority;
  completed?: boolean;
  tagIds?: string[];
  now: Date;
}

export interface ReconstituteTaskProps {
  id: string;
  accountId: string;
  title: string;
  notes: string | null;
  date: string;
  time: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  completed: boolean;
  tagIds: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface UpdateTaskProps {
  title?: string;
  notes?: string | null;
  date?: string;
  time?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  completed?: boolean;
  tagIds?: string[];
  now: Date;
}

export class Task implements SyncableEntity {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private _title: string,
    private _notes: string | null,
    private _date: string,
    private _time: string | null,
    private _category: TaskCategory,
    private _priority: TaskPriority,
    private _completed: boolean,
    private _tagIds: string[],
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _deletedAt: Date | null,
  ) {}

  public static create(props: CreateTaskProps): Task {
    Task.validateId(props.id);
    Task.validateAccountId(props.accountId);
    const validTitle = Task.validateAndTrimTitle(props.title);
    const validNotes = Task.validateAndNormalizeNotes(props.notes);
    Task.validateDate(props.date);
    const validTime = Task.validateAndNormalizeTime(props.time);
    Task.validateCategory(props.category);

    const priority = props.priority ?? 'normal';
    Task.validatePriority(priority);

    const completed = props.completed ?? false;
    if (typeof completed !== 'boolean') {
      throw new TaskValidationError('completed must be a boolean');
    }

    const tagIds = props.tagIds ?? [];
    Task.validateTagIds(tagIds);

    return new Task(
      props.id,
      props.accountId,
      validTitle,
      validNotes,
      props.date,
      validTime,
      props.category,
      priority,
      completed,
      [...tagIds],
      props.now,
      props.now,
      null,
    );
  }

  public static reconstitute(props: ReconstituteTaskProps): Task {
    return new Task(
      props.id,
      props.accountId,
      props.title,
      props.notes,
      props.date,
      props.time,
      props.category,
      props.priority,
      props.completed,
      [...props.tagIds],
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
    );
  }

  public update(props: UpdateTaskProps): void {
    if (this.isDeleted()) {
      throw new TaskValidationError('Cannot update deleted task');
    }

    let modified = false;

    if (props.title !== undefined) {
      this._title = Task.validateAndTrimTitle(props.title);
      modified = true;
    }

    if (props.notes !== undefined) {
      this._notes = Task.validateAndNormalizeNotes(props.notes);
      modified = true;
    }

    if (props.date !== undefined) {
      Task.validateDate(props.date);
      this._date = props.date;
      modified = true;
    }

    if (props.time !== undefined) {
      this._time = Task.validateAndNormalizeTime(props.time);
      modified = true;
    }

    if (props.category !== undefined) {
      Task.validateCategory(props.category);
      this._category = props.category;
      modified = true;
    }

    if (props.priority !== undefined) {
      Task.validatePriority(props.priority);
      this._priority = props.priority;
      modified = true;
    }

    if (props.completed !== undefined) {
      if (typeof props.completed !== 'boolean') {
        throw new TaskValidationError('completed must be a boolean');
      }
      this._completed = props.completed;
      modified = true;
    }

    if (props.tagIds !== undefined) {
      Task.validateTagIds(props.tagIds);
      this._tagIds = [...props.tagIds];
      modified = true;
    }

    if (modified) {
      this._updatedAt = props.now;
    }
  }

  public delete(now: Date): void {
    if (this._deletedAt === null) {
      this._deletedAt = now;
      this._updatedAt = now;
    }
  }

  public isDeleted(): boolean {
    return this._deletedAt !== null;
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get title(): string {
    return this._title;
  }

  get notes(): string | null {
    return this._notes;
  }

  get date(): string {
    return this._date;
  }

  get time(): string | null {
    return this._time;
  }

  get category(): TaskCategory {
    return this._category;
  }

  get priority(): TaskPriority {
    return this._priority;
  }

  get completed(): boolean {
    return this._completed;
  }

  get tagIds(): readonly string[] {
    return this._tagIds;
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

  private static validateId(id: string): void {
    if (!id || typeof id !== 'string' || !UUID_REGEX.test(id)) {
      throw new TaskValidationError('Task id must be a valid UUID');
    }
  }

  private static validateAccountId(accountId: string): void {
    if (!accountId || typeof accountId !== 'string' || accountId.trim() === '') {
      throw new TaskValidationError('accountId is required');
    }
  }

  private static validateAndTrimTitle(title: string): string {
    if (typeof title !== 'string') {
      throw new TaskValidationError('Task title must be a string');
    }
    const trimmed = title.trim();
    if (trimmed.length < 1 || trimmed.length > 120) {
      throw new TaskValidationError('Task title must be between 1 and 120 characters');
    }
    return trimmed;
  }

  private static validateAndNormalizeNotes(notes: string | null | undefined): string | null {
    if (notes === undefined || notes === null) {
      return null;
    }
    if (typeof notes !== 'string') {
      throw new TaskValidationError('Task notes must be a string');
    }
    if (notes.length > 1000) {
      throw new TaskValidationError('Task notes cannot exceed 1000 characters');
    }
    return notes;
  }

  private static validateDate(date: string): void {
    if (!date || typeof date !== 'string' || !DATE_REGEX.test(date)) {
      throw new TaskValidationError('Task date must be in YYYY-MM-DD format');
    }
    const [y, m, d] = date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    if (
      dateObj.getUTCFullYear() !== y ||
      dateObj.getUTCMonth() !== m - 1 ||
      dateObj.getUTCDate() !== d
    ) {
      throw new TaskValidationError('Task date is not a valid calendar date');
    }
  }

  private static validateAndNormalizeTime(time: string | null | undefined): string | null {
    if (time === undefined || time === null || time === '') {
      return null;
    }
    if (typeof time !== 'string' || !TIME_REGEX.test(time)) {
      throw new TaskValidationError('Task time must be in HH:mm format');
    }
    return time;
  }

  private static validateCategory(category: unknown): void {
    if (!isTaskCategory(category)) {
      throw new TaskValidationError('Task category must be either school or personal');
    }
  }

  private static validatePriority(priority: unknown): void {
    if (!isTaskPriority(priority)) {
      throw new TaskValidationError('Task priority must be either normal or high');
    }
  }

  private static validateTagIds(tagIds: unknown): void {
    if (!Array.isArray(tagIds)) {
      throw new TaskValidationError('Task tagIds must be an array');
    }
    if (tagIds.length > 10) {
      throw new TaskValidationError('Task tagIds cannot exceed 10 tags');
    }
    for (const tagId of tagIds) {
      if (typeof tagId !== 'string' || !UUID_REGEX.test(tagId)) {
        throw new TaskValidationError('Each tagId must be a valid UUID');
      }
    }
  }
}
