import { Tag } from '../../../src/domain/tag/tag.entity';
import { TagValidationError } from '../../../src/domain/tag/tag.errors';

describe('Tag Entity', () => {
  const validId = '11111111-1111-4111-8111-111111111111';
  const accountId = 'acc-1';
  const now = new Date('2026-10-26T12:00:00.000Z');

  describe('create', () => {
    it('creates a valid Tag and trims the name', () => {
      const tag = Tag.create({
        id: validId,
        accountId,
        name: '  Toán 10A1  ',
        tone: 'pink',
        now,
      });

      expect(tag.id).toBe(validId);
      expect(tag.accountId).toBe(accountId);
      expect(tag.name).toBe('Toán 10A1');
      expect(tag.tone).toBe('pink');
      expect(tag.createdAt).toEqual(now);
      expect(tag.updatedAt).toEqual(now);
      expect(tag.deletedAt).toBeNull();
      expect(tag.isDeleted()).toBe(false);
    });

    it('throws TagValidationError if id is not a valid UUID', () => {
      expect(() =>
        Tag.create({
          id: 'invalid-uuid',
          accountId,
          name: 'Văn 12',
          tone: 'blue',
          now,
        }),
      ).toThrow(TagValidationError);
    });

    it('throws TagValidationError if name is empty after trim', () => {
      expect(() =>
        Tag.create({
          id: validId,
          accountId,
          name: '   ',
          tone: 'blue',
          now,
        }),
      ).toThrow(TagValidationError);
    });

    it('throws TagValidationError if name exceeds 24 characters', () => {
      expect(() =>
        Tag.create({
          id: validId,
          accountId,
          name: 'Tên nhãn dài hơn 24 ký tự này nha',
          tone: 'blue',
          now,
        }),
      ).toThrow(TagValidationError);
    });

    it('throws TagValidationError if tone is invalid', () => {
      expect(() =>
        Tag.create({
          id: validId,
          accountId,
          name: 'Lý 11',
          tone: 'yellow' as any,
          now,
        }),
      ).toThrow(TagValidationError);
    });
  });

  describe('update', () => {
    it('updates name and tone and refreshes updatedAt', () => {
      const tag = Tag.create({
        id: validId,
        accountId,
        name: 'Sử 11',
        tone: 'pink',
        now,
      });

      const updatedTime = new Date('2026-10-26T14:00:00.000Z');
      tag.update({
        name: '  Sử 12  ',
        tone: 'mint',
        now: updatedTime,
      });

      expect(tag.name).toBe('Sử 12');
      expect(tag.tone).toBe('mint');
      expect(tag.updatedAt).toEqual(updatedTime);
    });

    it('throws TagValidationError when updating a deleted tag', () => {
      const tag = Tag.create({
        id: validId,
        accountId,
        name: 'Địa 10',
        tone: 'pink',
        now,
      });

      tag.delete(now);
      expect(tag.isDeleted()).toBe(true);

      expect(() =>
        tag.update({
          name: 'Địa 11',
          now: new Date(),
        }),
      ).toThrow(TagValidationError);
    });
  });

  describe('delete', () => {
    it('sets deletedAt and updatedAt on soft delete', () => {
      const tag = Tag.create({
        id: validId,
        accountId,
        name: 'Tin học',
        tone: 'lavender',
        now,
      });

      const deleteTime = new Date('2026-10-26T15:00:00.000Z');
      tag.delete(deleteTime);

      expect(tag.isDeleted()).toBe(true);
      expect(tag.deletedAt).toEqual(deleteTime);
      expect(tag.updatedAt).toEqual(deleteTime);
    });

    it('is idempotent on repeated delete call', () => {
      const tag = Tag.create({
        id: validId,
        accountId,
        name: 'Tin học',
        tone: 'lavender',
        now,
      });

      const deleteTime1 = new Date('2026-10-26T15:00:00.000Z');
      tag.delete(deleteTime1);

      const deleteTime2 = new Date('2026-10-26T16:00:00.000Z');
      tag.delete(deleteTime2);

      // Remains deleteTime1
      expect(tag.deletedAt).toEqual(deleteTime1);
    });
  });
});
