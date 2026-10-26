import { calculateTeacherToday } from '../../../src/domain/settings/teacher-today.helper';
import { FixedClock } from '../../fakes/fixed-clock';
import { SettingsValidationError } from '../../../src/domain/settings/settings.errors';

describe("Teacher's Today Helper", () => {
  describe('calculateTeacherToday', () => {
    it('calculates correct local date when UTC is late at night (23:30Z)', () => {
      // 2026-10-26 23:30:00 UTC
      const lateUtc = new Date('2026-10-26T23:30:00.000Z');

      // UTC itself is Oct 26
      const utcToday = calculateTeacherToday(lateUtc, 'UTC');
      expect(utcToday.dateString).toBe('2026-10-26');
      expect(utcToday.year).toBe(2026);
      expect(utcToday.month).toBe(10);
      expect(utcToday.day).toBe(26);

      // Asia/Ho_Chi_Minh is UTC+7 -> 06:30 AM Oct 27
      const vnToday = calculateTeacherToday(lateUtc, 'Asia/Ho_Chi_Minh');
      expect(vnToday.dateString).toBe('2026-10-27');
      expect(vnToday.year).toBe(2026);
      expect(vnToday.month).toBe(10);
      expect(vnToday.day).toBe(27);

      // America/New_York is UTC-4 in late October (EDT) -> 19:30 PM Oct 26
      const nyToday = calculateTeacherToday(lateUtc, 'America/New_York');
      expect(nyToday.dateString).toBe('2026-10-26');
      expect(nyToday.day).toBe(26);

      // Pacific/Auckland is UTC+13 (NZDT) -> 12:30 PM Oct 27
      const nzToday = calculateTeacherToday(lateUtc, 'Pacific/Auckland');
      expect(nzToday.dateString).toBe('2026-10-27');
      expect(nzToday.day).toBe(27);

      // Pacific/Honolulu is UTC-10 -> 13:30 PM Oct 26
      const hnlToday = calculateTeacherToday(lateUtc, 'Pacific/Honolulu');
      expect(hnlToday.dateString).toBe('2026-10-26');
      expect(hnlToday.day).toBe(26);
    });

    it('calculates correct local date when UTC is early in morning (01:30Z)', () => {
      // 2026-10-26 01:30:00 UTC
      const earlyUtc = new Date('2026-10-26T01:30:00.000Z');

      // UTC is Oct 26
      const utcToday = calculateTeacherToday(earlyUtc, 'UTC');
      expect(utcToday.dateString).toBe('2026-10-26');

      // America/Los_Angeles is UTC-7 (PDT) -> 18:30 PM Oct 25 (previous day!)
      const laToday = calculateTeacherToday(earlyUtc, 'America/Los_Angeles');
      expect(laToday.dateString).toBe('2026-10-25');
      expect(laToday.year).toBe(2026);
      expect(laToday.month).toBe(10);
      expect(laToday.day).toBe(25);

      // Asia/Tokyo is UTC+9 -> 10:30 AM Oct 26
      const tokyoToday = calculateTeacherToday(earlyUtc, 'Asia/Tokyo');
      expect(tokyoToday.dateString).toBe('2026-10-26');
      expect(tokyoToday.day).toBe(26);
    });

    it('handles year transition across timezones at New Year midnight', () => {
      // 2026-12-31 23:50:00 UTC
      const newYearEve = new Date('2026-12-31T23:50:00.000Z');

      // Asia/Ho_Chi_Minh is UTC+7 -> Jan 1, 2027 06:50 AM
      const vnToday = calculateTeacherToday(newYearEve, 'Asia/Ho_Chi_Minh');
      expect(vnToday.dateString).toBe('2027-01-01');
      expect(vnToday.year).toBe(2027);
      expect(vnToday.month).toBe(1);
      expect(vnToday.day).toBe(1);
      expect(vnToday.dayOfYear).toBe(1);

      // UTC is Dec 31, 2026 (day 365)
      const utcToday = calculateTeacherToday(newYearEve, 'UTC');
      expect(utcToday.dateString).toBe('2026-12-31');
      expect(utcToday.year).toBe(2026);
      expect(utcToday.month).toBe(12);
      expect(utcToday.day).toBe(31);
      expect(utcToday.dayOfYear).toBe(365);
    });

    it('throws SettingsValidationError on invalid timezone', () => {
      const now = new Date();
      expect(() => calculateTeacherToday(now, 'Invalid/Zone')).toThrow(SettingsValidationError);
      expect(() => calculateTeacherToday(now, '')).toThrow(SettingsValidationError);
    });

    it('accepts Clock port now() and computes local today', () => {
      const clock = new FixedClock(new Date('2026-10-26T23:45:00.000Z'));
      const teacherToday = calculateTeacherToday(clock.now(), 'Asia/Ho_Chi_Minh');

      expect(teacherToday.dateString).toBe('2026-10-27');
      expect(teacherToday.year).toBe(2026);
      expect(teacherToday.month).toBe(10);
      expect(teacherToday.day).toBe(27);
    });
  });
});
