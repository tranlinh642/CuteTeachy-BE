import { SyncableEntity } from '../shared/sync-idempotency';
import { TagTone, isTagTone } from './tag-tone.vo';
import { TagValidationError } from './tag.errors';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CreateTagProps {
  id: string;
  accountId: string;
  name: string;
  tone: TagTone;
  now: Date;
}

export interface ReconstituteTagProps {
  id: string;
  accountId: string;
  name: string;
  tone: TagTone;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface UpdateTagProps {
  name?: string;
  tone?: TagTone;
  now: Date;
}

export class Tag implements SyncableEntity {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private _name: string,
    private _tone: TagTone,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _deletedAt: Date | null,
  ) {}

  public static create(props: CreateTagProps): Tag {
    Tag.validateId(props.id);
    Tag.validateAccountId(props.accountId);
    const validName = Tag.validateAndTrimName(props.name);
    Tag.validateTone(props.tone);

    return new Tag(props.id, props.accountId, validName, props.tone, props.now, props.now, null);
  }

  public static reconstitute(props: ReconstituteTagProps): Tag {
    return new Tag(
      props.id,
      props.accountId,
      props.name,
      props.tone,
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
    );
  }

  public update(props: UpdateTagProps): void {
    if (this.isDeleted()) {
      throw new TagValidationError('Cannot update deleted tag');
    }

    let modified = false;

    if (props.name !== undefined) {
      const validName = Tag.validateAndTrimName(props.name);
      this._name = validName;
      modified = true;
    }

    if (props.tone !== undefined) {
      Tag.validateTone(props.tone);
      this._tone = props.tone;
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

  get name(): string {
    return this._name;
  }

  get tone(): TagTone {
    return this._tone;
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
      throw new TagValidationError('Tag id must be a valid UUID');
    }
  }

  private static validateAccountId(accountId: string): void {
    if (!accountId || typeof accountId !== 'string' || accountId.trim() === '') {
      throw new TagValidationError('accountId is required');
    }
  }

  private static validateAndTrimName(name: string): string {
    if (typeof name !== 'string') {
      throw new TagValidationError('Tag name must be a string');
    }
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 24) {
      throw new TagValidationError('Tag name must be between 1 and 24 characters');
    }
    return trimmed;
  }

  private static validateTone(tone: unknown): void {
    if (!isTagTone(tone)) {
      throw new TagValidationError(
        'Tag tone must be one of pink, blue, beige, lavender, rose, mint',
      );
    }
  }
}
