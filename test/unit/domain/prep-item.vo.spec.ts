import {
  validatePrepItem,
  validatePrepItems,
} from '../../../src/domain/class-session/prep-item.vo';
import { ClassSessionValidationError } from '../../../src/domain/class-session/class-session.errors';

describe('PrepItem Value Object', () => {
  describe('validatePrepItem', () => {
    it('validates and trims valid prep item', () => {
      const item = validatePrepItem({
        id: 'item-1',
        label: '  Chuẩn bị giáo án  ',
        done: false,
      });

      expect(item).toEqual({
        id: 'item-1',
        label: 'Chuẩn bị giáo án',
        done: false,
      });
    });

    it('rejects non-object item', () => {
      expect(() => validatePrepItem(null)).toThrow(ClassSessionValidationError);
      expect(() => validatePrepItem('not an object')).toThrow(ClassSessionValidationError);
    });

    it('rejects empty or missing id', () => {
      expect(() => validatePrepItem({ id: '', label: 'Test', done: false })).toThrow(
        ClassSessionValidationError,
      );
      expect(() => validatePrepItem({ id: '   ', label: 'Test', done: false })).toThrow(
        ClassSessionValidationError,
      );
      expect(() => validatePrepItem({ label: 'Test', done: false })).toThrow(
        ClassSessionValidationError,
      );
    });

    it('rejects empty or missing label', () => {
      expect(() => validatePrepItem({ id: '1', label: '', done: false })).toThrow(
        ClassSessionValidationError,
      );
      expect(() => validatePrepItem({ id: '1', label: '   ', done: false })).toThrow(
        ClassSessionValidationError,
      );
      expect(() => validatePrepItem({ id: '1', done: false })).toThrow(
        ClassSessionValidationError,
      );
    });

    it('rejects non-boolean done', () => {
      expect(() => validatePrepItem({ id: '1', label: 'Test', done: 'yes' })).toThrow(
        ClassSessionValidationError,
      );
      expect(() => validatePrepItem({ id: '1', label: 'Test', done: null })).toThrow(
        ClassSessionValidationError,
      );
    });
  });

  describe('validatePrepItems', () => {
    it('returns empty array when given empty array', () => {
      expect(validatePrepItems([])).toEqual([]);
    });

    it('validates array of prep items up to 100 items', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i + 1}`,
        label: `Mục ${i + 1}`,
        done: i % 2 === 0,
      }));

      const result = validatePrepItems(items);
      expect(result).toHaveLength(100);
    });

    it('rejects more than 100 items', () => {
      const items = Array.from({ length: 101 }, (_, i) => ({
        id: `item-${i + 1}`,
        label: `Mục ${i + 1}`,
        done: false,
      }));

      expect(() => validatePrepItems(items)).toThrow(
        'prepItems cannot exceed 100 items',
      );
    });

    it('rejects non-array input', () => {
      expect(() => validatePrepItems(null)).toThrow(ClassSessionValidationError);
      expect(() => validatePrepItems({})).toThrow(ClassSessionValidationError);
    });
  });
});
