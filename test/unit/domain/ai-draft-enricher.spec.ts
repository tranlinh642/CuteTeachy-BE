import {
  computeContextDateWindow,
  enrichDraftItemsWithConflicts,
} from '../../../src/domain/ai-assistant/ai-draft-enricher';
import { TimetableSlot } from '../../../src/domain/timetable/timetable-slot.entity';

describe('AI Draft Enricher (Domain)', () => {
  const now = new Date('2026-10-29T02:00:00.000Z');
  const today = '2026-10-29';

  describe('computeContextDateWindow', () => {
    it('returns default [-7 days, +14 days] window around today when message has no explicit dates', () => {
      const window = computeContextDateWindow(today, 'Hôm nay tôi có lịch dạy gì không?');
      expect(window).toEqual({
        windowFrom: '2026-10-22',
        windowTo: '2026-11-12',
      });
    });

    it('expands window when message contains explicit YYYY-MM-DD or DD/MM/YYYY dates within [-60, +60] days', () => {
      const window = computeContextDateWindow(
        today,
        'Xem lịch từ 2026-10-10 đến 25/11/2026 giúp tôi',
      );
      expect(window).toEqual({
        windowFrom: '2026-10-10',
        windowTo: '2026-11-25',
      });
    });

    it('ignores dates outside the [-60, +60] days safety bound', () => {
      const window = computeContextDateWindow(
        today,
        'Ngày 2025-01-01 và 31/12/2027 có gì không?',
      );
      expect(window).toEqual({
        windowFrom: '2026-10-22',
        windowTo: '2026-11-12',
      });
    });
  });

  describe('enrichDraftItemsWithConflicts', () => {
    it('normalizes defaults and attaches conflict metadata when a timetable_slot item overlaps an active slot', () => {
      const existingSlot = TimetableSlot.create({
        id: '11111111-1111-4111-8111-111111111111',
        accountId: 'acc-1',
        weekday: 2,
        startTime: '07:00',
        endTime: '07:45',
        subject: 'Toán 9A (Cũ)',
        tone: 'pink',
        category: 'school_teaching',
        effectiveFrom: '2026-09-01',
        now,
      });

      let seq = 1;
      const items = enrichDraftItemsWithConflicts(
        [
          {
            id: '',
            kind: 'timetable_slot',
            category: 'school_teaching',
            titleOrSubject: 'Toán 9A (Mới)',
            weekday: 2,
            startTime: '07:00',
            endTime: '07:45',
          },
          {
            id: 'custom-task-id',
            kind: 'task',
            category: 'self_study',
            titleOrSubject: 'Soạn đề cương',
          },
        ],
        {
          today,
          activeSlots: [existingSlot],
          generateId: () => `gen-id-${seq++}`,
        },
      );

      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({
        id: 'gen-id-1',
        kind: 'timetable_slot',
        effectiveFrom: today,
        date: null,
        tone: 'blue',
        conflict: {
          slotId: existingSlot.id,
          subject: 'Toán 9A (Cũ)',
          startTime: '07:00',
          endTime: '07:45',
        },
      });
      expect(items[1]).toMatchObject({
        id: 'custom-task-id',
        kind: 'task',
        date: today,
        effectiveFrom: null,
        conflict: null,
      });
    });
  });
});
