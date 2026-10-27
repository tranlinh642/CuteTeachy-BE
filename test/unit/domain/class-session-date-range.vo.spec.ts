import { ClassSessionDateRange } from '../../../src/domain/class-session/date-range.vo';
import { ClassSessionValidationError } from '../../../src/domain/class-session/class-session.errors';

describe('ClassSessionDateRange VO', () => {
  it('creates valid range', () => {
    const range = ClassSessionDateRange.create('2026-10-01', '2026-10-15');
    expect(range.from).toBe('2026-10-01');
    expect(range.to).toBe('2026-10-15');
  });

  it('allows range up to 42 days', () => {
    const range = ClassSessionDateRange.create('2026-10-01', '2026-11-12');
    expect(range.from).toBe('2026-10-01');
    expect(range.to).toBe('2026-11-12');
  });

  it('rejects range exceeding 42 days', () => {
    expect(() => ClassSessionDateRange.create('2026-10-01', '2026-11-13')).toThrow(
      ClassSessionValidationError,
    );
  });

  it('rejects from date after to date', () => {
    expect(() => ClassSessionDateRange.create('2026-10-15', '2026-10-01')).toThrow(
      ClassSessionValidationError,
    );
  });

  it('rejects invalid format or calendar dates', () => {
    expect(() => ClassSessionDateRange.create('2026/10/01', '2026-10-15')).toThrow(
      ClassSessionValidationError,
    );
    expect(() => ClassSessionDateRange.create('2026-02-30', '2026-03-05')).toThrow(
      ClassSessionValidationError,
    );
  });
});
