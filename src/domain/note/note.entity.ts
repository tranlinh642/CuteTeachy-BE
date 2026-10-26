import { SyncableEntity } from '../shared/sync-idempotency';
import { ChecklistItem, validateChecklistItem } from './checklist-item.vo';
import { NoteValidationError } from './note.errors';
import { normalizeVietnamese } from './vietnamese-normalize';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface CreateNoteProps {
  id: string;
  accountId: string;
  title: string;
  content?: string | null;
  checklist?: ChecklistItem[];
  imageUrl?: string | null;
  tagIds?: string[];
  dueDate?: string | null;
  completed?: boolean;
  now: Date;
}

export interface ReconstituteNoteProps {
  id: string;
  accountId: string;
  title: string;
  content: string | null;
  checklist: ChecklistItem[];
  imageUrl: string | null;
  tagIds: string[];
  dueDate: string | null;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface UpdateNoteProps {
  title?: string;
  content?: string | null;
  checklist?: ChecklistItem[];
  imageUrl?: string | null;
  tagIds?: string[];
  dueDate?: string | null;
  completed?: boolean;
  now: Date;
}

export class Note implements SyncableEntity {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private _title: string,
    private _content: string | null,
    private _checklist: ChecklistItem[],
    private _imageUrl: string | null,
    private _tagIds: string[],
    private _dueDate: string | null,
    private _completed: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _deletedAt: Date | null,
  ) {}

  public static create(props: CreateNoteProps): Note {
    Note.validateId(props.id);
    Note.validateAccountId(props.accountId);
    const validTitle = Note.validateAndTrimTitle(props.title);
    const validContent = Note.validateAndNormalizeContent(props.content);
    const validChecklist = Note.validateChecklist(props.checklist);
    const validTagIds = Note.validateTagIds(props.tagIds);
    const validDueDate = Note.validateDueDate(props.dueDate);

    let completed: boolean;
    if (validChecklist.length > 0) {
      completed = validChecklist.every((item) => item.done);
    } else {
      const clientCompleted = props.completed ?? false;
      if (typeof clientCompleted !== 'boolean') {
        throw new NoteValidationError('completed must be a boolean');
      }
      completed = clientCompleted;
    }

    return new Note(
      props.id,
      props.accountId,
      validTitle,
      validContent,
      validChecklist,
      props.imageUrl ?? null,
      validTagIds,
      validDueDate,
      completed,
      props.now,
      props.now,
      null,
    );
  }

  public static reconstitute(props: ReconstituteNoteProps): Note {
    return new Note(
      props.id,
      props.accountId,
      props.title,
      props.content,
      [...props.checklist],
      props.imageUrl,
      [...props.tagIds],
      props.dueDate,
      props.completed,
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
    );
  }

  public update(props: UpdateNoteProps): void {
    if (props.title !== undefined) {
      this._title = Note.validateAndTrimTitle(props.title);
    }

    if (props.content !== undefined) {
      this._content = Note.validateAndNormalizeContent(props.content);
    }

    if (props.imageUrl !== undefined) {
      this._imageUrl = props.imageUrl;
    }

    if (props.tagIds !== undefined) {
      this._tagIds = Note.validateTagIds(props.tagIds);
    }

    if (props.dueDate !== undefined) {
      this._dueDate = Note.validateDueDate(props.dueDate);
    }

    if (props.checklist !== undefined) {
      this._checklist = Note.validateChecklist(props.checklist);
      if (this._checklist.length > 0) {
        this._completed = this._checklist.every((item) => item.done);
      } else if (props.completed !== undefined) {
        if (typeof props.completed !== 'boolean') {
          throw new NoteValidationError('completed must be a boolean');
        }
        this._completed = props.completed;
      }
    } else {
      if (this._checklist.length > 0) {
        this._completed = this._checklist.every((item) => item.done);
      } else if (props.completed !== undefined) {
        if (typeof props.completed !== 'boolean') {
          throw new NoteValidationError('completed must be a boolean');
        }
        this._completed = props.completed;
      }
    }

    this._updatedAt = props.now;
  }

  public delete(now: Date): void {
    this._deletedAt = now;
    this._updatedAt = now;
  }

  public isDeleted(): boolean {
    return this._deletedAt !== null;
  }

  public getSearchContent(): string {
    const parts = [
      this._title,
      this._content ?? '',
      ...this._checklist.map((item) => item.text),
    ];
    return normalizeVietnamese(parts.filter(Boolean).join(' '));
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

  get content(): string | null {
    return this._content;
  }

  get checklist(): readonly ChecklistItem[] {
    return this._checklist;
  }

  get imageUrl(): string | null {
    return this._imageUrl;
  }

  get tagIds(): readonly string[] {
    return this._tagIds;
  }

  get dueDate(): string | null {
    return this._dueDate;
  }

  get completed(): boolean {
    return this._completed;
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
      throw new NoteValidationError('Note id must be a valid UUID');
    }
  }

  private static validateAccountId(accountId: string): void {
    if (!accountId || typeof accountId !== 'string' || accountId.trim().length === 0) {
      throw new NoteValidationError('accountId is required');
    }
  }

  private static validateAndTrimTitle(title: string): string {
    if (typeof title !== 'string') {
      throw new NoteValidationError('Note title must be a string');
    }
    const trimmed = title.trim();
    if (trimmed.length < 1 || trimmed.length > 120) {
      throw new NoteValidationError('Note title must be between 1 and 120 characters');
    }
    return trimmed;
  }

  private static validateAndNormalizeContent(content: string | null | undefined): string | null {
    if (content === undefined || content === null || content === '') {
      return null;
    }
    if (typeof content !== 'string') {
      throw new NoteValidationError('Note content must be a string');
    }
    if (content.length > 5000) {
      throw new NoteValidationError('Note content cannot exceed 5000 characters');
    }
    return content;
  }

  private static validateChecklist(checklist: unknown): ChecklistItem[] {
    if (checklist === undefined || checklist === null) {
      return [];
    }
    if (!Array.isArray(checklist)) {
      throw new NoteValidationError('checklist must be an array');
    }
    if (checklist.length > 100) {
      throw new NoteValidationError('checklist cannot exceed 100 items');
    }
    return checklist.map(validateChecklistItem);
  }

  private static validateTagIds(tagIds: unknown): string[] {
    if (tagIds === undefined || tagIds === null) {
      return [];
    }
    if (!Array.isArray(tagIds)) {
      throw new NoteValidationError('tagIds must be an array');
    }
    if (tagIds.length > 10) {
      throw new NoteValidationError('tagIds cannot exceed 10 items');
    }
    for (const tagId of tagIds) {
      if (typeof tagId !== 'string' || tagId.trim().length === 0) {
        throw new NoteValidationError('each tagId must be a non-empty string');
      }
    }
    return Array.from(new Set(tagIds));
  }

  private static validateDueDate(dueDate: unknown): string | null {
    if (dueDate === undefined || dueDate === null || dueDate === '') {
      return null;
    }
    if (typeof dueDate !== 'string') {
      throw new NoteValidationError('dueDate must be a string');
    }

    if (DATE_REGEX.test(dueDate)) {
      const [y, m, d] = dueDate.split('-').map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d));
      if (
        dateObj.getUTCFullYear() !== y ||
        dateObj.getUTCMonth() !== m - 1 ||
        dateObj.getUTCDate() !== d
      ) {
        throw new NoteValidationError('dueDate is not a valid calendar date');
      }
      return dueDate;
    }

    const parsed = new Date(dueDate);
    if (isNaN(parsed.getTime())) {
      throw new NoteValidationError('dueDate is not a valid date string');
    }
    return dueDate;
  }
}
