import { EntityGoneError, IdConflictError } from './sync.errors';

export interface SyncableEntity {
  readonly accountId: string;
  isDeleted(): boolean;
}

export type IdempotentCreationResult<T extends SyncableEntity> =
  { kind: 'create' } | { kind: 'existing'; entity: T };

export function checkCreationIdempotency<T extends SyncableEntity>(
  existingEntity: T | null,
  currentAccountId: string,
): IdempotentCreationResult<T> {
  if (!existingEntity) {
    return { kind: 'create' };
  }

  if (existingEntity.accountId !== currentAccountId) {
    throw new IdConflictError('Resource id belongs to another account');
  }

  if (existingEntity.isDeleted()) {
    throw new EntityGoneError('Resource has been deleted');
  }

  return { kind: 'existing', entity: existingEntity };
}
