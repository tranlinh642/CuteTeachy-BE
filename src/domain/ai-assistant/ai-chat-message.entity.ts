import {
  AiAssistantValidationError,
  AiDraftAlreadyAppliedError,
} from './ai-assistant.errors';
import {
  AiConflictStrategy,
  AiScheduleDraft,
  AiScheduleDraftItem,
  AiScheduleDraftSummary,
  isAiConflictStrategy,
  validateAiScheduleDraftItem,
} from './ai-schedule-draft.vo';

export type AiChatRole = 'user' | 'assistant';

export interface CreateAiChatMessageProps {
  id: string;
  accountId: string;
  role: AiChatRole;
  content: string;
  imageUrl?: string | null;
  imageKey?: string | null;
  imageExpiresAt?: Date | null;
  draft?: AiScheduleDraft | null;
  now: Date;
}

export interface ReconstituteAiChatMessageProps {
  id: string;
  accountId: string;
  role: AiChatRole;
  content: string;
  imageUrl?: string | null;
  imageKey?: string | null;
  imageExpiresAt?: Date | null;
  draft?: AiScheduleDraft | null;
  createdAt: Date;
}

export class AiChatMessage {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _role: AiChatRole,
    private readonly _content: string,
    private _imageUrl: string | null,
    private _imageKey: string | null,
    private _imageExpiresAt: Date | null,
    private _draft: AiScheduleDraft | null,
    private readonly _createdAt: Date,
  ) {}

  public static create(props: CreateAiChatMessageProps): AiChatMessage {
    if (!props.id || typeof props.id !== 'string' || props.id.trim().length === 0) {
      throw new AiAssistantValidationError('Message id is required');
    }
    if (
      !props.accountId ||
      typeof props.accountId !== 'string' ||
      props.accountId.trim().length === 0
    ) {
      throw new AiAssistantValidationError('accountId is required');
    }
    if (props.role !== 'user' && props.role !== 'assistant') {
      throw new AiAssistantValidationError('role must be user or assistant');
    }
    if (typeof props.content !== 'string') {
      throw new AiAssistantValidationError('content must be a string');
    }

    let normalizedDraft: AiScheduleDraft | null = null;
    if (props.draft) {
      normalizedDraft = {
        status: props.draft.status,
        appliedAt: props.draft.appliedAt ?? null,
        conflictStrategy: props.draft.conflictStrategy ?? null,
        summary: props.draft.summary ?? null,
        items: props.draft.items.map(validateAiScheduleDraftItem),
      };
    }

    return new AiChatMessage(
      props.id,
      props.accountId,
      props.role,
      props.content,
      props.imageUrl ?? null,
      props.imageKey ?? null,
      props.imageExpiresAt ?? null,
      normalizedDraft,
      props.now,
    );
  }

  public static reconstitute(props: ReconstituteAiChatMessageProps): AiChatMessage {
    return new AiChatMessage(
      props.id,
      props.accountId,
      props.role,
      props.content,
      props.imageUrl ?? null,
      props.imageKey ?? null,
      props.imageExpiresAt ?? null,
      props.draft ?? null,
      props.createdAt,
    );
  }

  public static rehydrate(props: ReconstituteAiChatMessageProps): AiChatMessage {
    return AiChatMessage.reconstitute(props);
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get role(): AiChatRole {
    return this._role;
  }

  get content(): string {
    return this._content;
  }

  get imageUrl(): string | null {
    return this._imageUrl;
  }

  get imageKey(): string | null {
    return this._imageKey;
  }

  get imageExpiresAt(): Date | null {
    return this._imageExpiresAt;
  }

  get draft(): AiScheduleDraft | null {
    return this._draft;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  public markDraftApplied(params: {
    appliedAt: string;
    conflictStrategy: AiConflictStrategy;
    summary: AiScheduleDraftSummary;
    items: AiScheduleDraftItem[];
  }): void {
    if (!this._draft) {
      throw new AiAssistantValidationError('Message does not contain a schedule draft');
    }
    if (this._draft.status === 'applied') {
      throw new AiDraftAlreadyAppliedError();
    }
    if (!isAiConflictStrategy(params.conflictStrategy)) {
      throw new AiAssistantValidationError(
        'conflictStrategy must be replace_conflicts, skip_conflicts, or replace_all_timetable',
      );
    }

    const summary: AiScheduleDraftSummary = {
      createdCount: params.summary.createdCount,
      replacedCount: params.summary.replacedCount,
      skippedCount: params.summary.skippedCount,
      ...(params.summary.updatedCount ? { updatedCount: params.summary.updatedCount } : {}),
      ...(params.summary.deletedCount ? { deletedCount: params.summary.deletedCount } : {}),
      ...(params.summary.cancelledCount ? { cancelledCount: params.summary.cancelledCount } : {}),
    };

    this._draft = {
      status: 'applied',
      appliedAt: params.appliedAt,
      conflictStrategy: params.conflictStrategy,
      summary,
      items: params.items.map(validateAiScheduleDraftItem),
    };
  }

  public isImageExpired(now: Date): boolean {
    return (
      this._imageKey !== null &&
      this._imageExpiresAt !== null &&
      this._imageExpiresAt.getTime() <= now.getTime()
    );
  }

  public clearExpiredImage(): void {
    this._imageUrl = null;
    this._imageKey = null;
    this._imageExpiresAt = null;
  }
}
