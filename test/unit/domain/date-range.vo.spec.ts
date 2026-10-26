import { DateRange, MAX_DATE_RANGE_DAYS } from '../../../src/domain/task/date-range.vo';
import { TaskValidationError } from '../../../src/domain/task/task.errors';

describe('DateRange Value Object', () => {
  it('creates valid date range', () => {
    const range = DateRange.create('2026-10-01', '2026-10-31');
    expect(range.from).toBe('2026-10-01');
    expect(range.to).toBe('2026-10-31');
  });

  it('allows same from and to (single day range)', () => {
    const range = DateRange.create('2026-10-15', '2026-10-15');
    expect(range.from).toBe('2026-10-15');
    expect(range.to).toBe('2026-10-15');
  });

  it('allows exactly 42 days range', () => {
    const range = DateRange.create('2026-10-01', '2026-11-12');
    expect(range.from).toBe('2026-10-01');
    expect(range.to).toBe('2026-11-12');
  });

  it('throws TaskValidationError on invalid format for from or to', () => {
    expect(() => DateRange.create('2026/10/01', '2026-10-31')).toThrow(TaskValidationError);
    expect(() => DateRange.create('2026-10-01', 'invalid')).toThrow(TaskValidationError);
    expect(() => DateRange.create('', '2026-10-31')).toThrow(TaskValidationError);
  });

  it('throws TaskValidationError on invalid calendar date', () => {
    expect(() => DateRange.create('2026-02-30', '2026-03-15')).toThrow(TaskValidationError);
    expect(() => DateRange.create('2026-10-01', '2026-13-01')).toThrow(TaskValidationError);
  });

  it('throws TaskValidationError if from is after to', () => {
    expect(() => DateRange.create('2026-10-31', '2026-10-01')).toThrow(TaskValidationError);
  });

  it(`throws TaskValidationError if date range exceeds ${MAX_DATE_RANGE_DAYS} days`, () => {
    expect(() => DateRange.create('2026-10-01', '2026-11-13')).toThrow(TaskValidationError);
  });
});
