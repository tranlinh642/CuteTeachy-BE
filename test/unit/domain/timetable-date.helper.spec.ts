import { getPreviousDay } from '../../../src/domain/timetable/timetable-date.helper';

describe('Timetable Date Helper', () => {
  describe('getPreviousDay', () => {
    it('returns the previous day in the same month', () => {
      expect(getPreviousDay('2026-10-27')).toBe('2026-10-26');
      expect(getPreviousDay('2026-10-15')).toBe('2026-10-14');
      expect(getPreviousDay('2026-10-02')).toBe('2026-10-01');
    });

    it('handles month boundaries for 31-day previous month', () => {
      expect(getPreviousDay('2026-10-01')).toBe('2026-09-30');
      expect(getPreviousDay('2026-08-01')).toBe('2026-07-31');
    });

    it('handles month boundaries for February in non-leap year (2026)', () => {
      expect(getPreviousDay('2026-03-01')).toBe('2026-02-28');
    });

    it('handles month boundaries for February in leap year (2024)', () => {
      expect(getPreviousDay('2024-03-01')).toBe('2024-02-29');
    });

    it('handles year boundaries', () => {
      expect(getPreviousDay('2026-01-01')).toBe('2025-12-31');
      expect(getPreviousDay('2025-01-01')).toBe('2024-12-31');
    });
  });
});
