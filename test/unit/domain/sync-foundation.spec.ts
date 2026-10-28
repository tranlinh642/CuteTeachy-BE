import {
  parseAndValidateUpdatedSince,
  MAX_SYNC_WINDOW_MS,
} from '../../../src/domain/shared/sync-time';
import {
  checkCreationIdempotency,
  SyncableEntity,
} from '../../../src/domain/shared/sync-idempotency';
import {
  EntityGoneError,
  IdConflictError,
  SyncValidationError,
} from '../../../src/domain/shared/sync.errors';

class MockSyncEntity implements SyncableEntity {
  constructor(
    public readonly accountId: string,
    public readonly deleted: boolean,
  ) {}

  isDeleted(): boolean {
    return this.deleted;
  }
}

describe('Sync Foundation (Shared)', () => {
  describe('parseAndValidateUpdatedSince', () => {
    const fixedNow = new Date('2026-10-26T12:00:00.000Z');

    it('returns undefined when updatedSince is undefined or whitespace', () => {
      expect(parseAndValidateUpdatedSince(undefined, fixedNow)).toBeUndefined();
      expect(parseAndValidateUpdatedSince('', fixedNow)).toBeUndefined();
      expect(parseAndValidateUpdatedSince('   ', fixedNow)).toBeUndefined();
    });

    it('returns parsed Date when valid and within 30 days', () => {
      const recentDateStr = '2026-10-20T10:00:00.000Z';
      const result = parseAndValidateUpdatedSince(recentDateStr, fixedNow);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(recentDateStr);
    });

    it('returns parsed Date at exact 30-day boundary', () => {
      const exact30DaysAgo = new Date(fixedNow.getTime() - MAX_SYNC_WINDOW_MS);
      const result = parseAndValidateUpdatedSince(exact30DaysAgo.toISOString(), fixedNow);
      expect(result?.getTime()).toBe(exact30DaysAgo.getTime());
    });

    it('throws SyncValidationError if updatedSince string is invalid date format', () => {
      expect(() => parseAndValidateUpdatedSince('not-a-date', fixedNow)).toThrow(
        SyncValidationError,
      );
      expect(() => parseAndValidateUpdatedSince('not-a-date', fixedNow)).toThrow(
        'Invalid updatedSince date string',
      );
    });

    it('throws SyncValidationError if updatedSince is older than 30 days', () => {
      const olderThan30Days = new Date(fixedNow.getTime() - MAX_SYNC_WINDOW_MS - 1000);
      expect(() => parseAndValidateUpdatedSince(olderThan30Days.toISOString(), fixedNow)).toThrow(
        SyncValidationError,
      );
      expect(() => parseAndValidateUpdatedSince(olderThan30Days.toISOString(), fixedNow)).toThrow(
        'updatedSince cannot be older than 30 days',
      );
    });
  });

  describe('checkCreationIdempotency', () => {
    const currentAccount = 'acc-123';
    const otherAccount = 'acc-456';

    it('returns { kind: "create" } when entity does not exist', () => {
      const result = checkCreationIdempotency(null, currentAccount);
      expect(result).toEqual({ kind: 'create' });
    });

    it('throws IdConflictError when existing entity belongs to another account', () => {
      const entity = new MockSyncEntity(otherAccount, false);
      expect(() => checkCreationIdempotency(entity, currentAccount)).toThrow(IdConflictError);
      expect(() => checkCreationIdempotency(entity, currentAccount)).toThrow(
        'Resource id belongs to another account',
      );
    });

    it('throws EntityGoneError when existing entity has been soft-deleted', () => {
      const entity = new MockSyncEntity(currentAccount, true);
      expect(() => checkCreationIdempotency(entity, currentAccount)).toThrow(EntityGoneError);
      expect(() => checkCreationIdempotency(entity, currentAccount)).toThrow(
        'Resource has been deleted',
      );
    });

    it('returns { kind: "existing", entity } when existing entity belongs to same account and is active', () => {
      const entity = new MockSyncEntity(currentAccount, false);
      const result = checkCreationIdempotency(entity, currentAccount);
      expect(result).toEqual({ kind: 'existing', entity });
    });
  });
});
