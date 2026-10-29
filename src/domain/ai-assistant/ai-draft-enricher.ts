import {
  CandidateSlot,
  findConflictingSlot,
  hasTimetableConflict,
} from '../timetable/timetable-conflict';
import { addDaysToDateString } from '../timetable/timetable-date.helper';
import { TimetableSlot } from '../timetable/timetable-slot.entity';
import {
  AiDraftItemKind,
  AiScheduleDraftItem,
  validateAiScheduleDraftItem,
} from './ai-schedule-draft.vo';

export function computeContextDateWindow(
  today: string,
  message: string,
): { windowFrom: string; windowTo: string } {
  let windowFrom = addDaysToDateString(today, -7);
  let windowTo = addDaysToDateString(today, 14);

  // Check if message mentions explicit YYYY-MM-DD or DD/MM/YYYY dates
  const isoMatches = message.match(/\b(\d{4}-\d{2}-\d{2})\b/g) ?? [];
  const dmyMatches = message.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g) ?? [];

  const candidateDates: string[] = [...isoMatches];
  for (const dmy of dmyMatches) {
    const [d, m, y] = dmy.split('/');
    candidateDates.push(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
  }

  const minAllowed = addDaysToDateString(today, -60);
  const maxAllowed = addDaysToDateString(today, 60);

  for (const dt of candidateDates) {
    if (dt >= minAllowed && dt < windowFrom) {
      windowFrom = dt;
    }
    if (dt <= maxAllowed && dt > windowTo) {
      windowTo = dt;
    }
  }

  return { windowFrom, windowTo };
}

export interface EnrichDraftItemsOptions {
  today: string;
  activeSlots: readonly TimetableSlot[];
  generateId: () => string;
}

export function enrichDraftItemsWithConflicts(
  rawItems: readonly Partial<AiScheduleDraftItem>[],
  options: EnrichDraftItemsOptions,
): AiScheduleDraftItem[] {
  const { today, activeSlots, generateId } = options;

  return rawItems.map((rawItem) => {
    const normalized = validateAiScheduleDraftItem({
      ...rawItem,
      id: rawItem.id || generateId(),
      kind: rawItem.kind as AiDraftItemKind,
      titleOrSubject: rawItem.titleOrSubject ?? '',
      category: rawItem.category ?? 'school_teaching',
      tone: rawItem.tone ?? 'blue',
      effectiveFrom:
        rawItem.kind === 'timetable_slot'
          ? (rawItem.effectiveFrom ?? today)
          : (rawItem.effectiveFrom ?? null),
      date:
        rawItem.kind === 'class_session' || rawItem.kind === 'task'
          ? (rawItem.date ?? today)
          : (rawItem.date ?? null),
    });

    if (
      normalized.kind === 'timetable_slot' &&
      normalized.weekday &&
      normalized.startTime &&
      normalized.endTime
    ) {
      const candidate: CandidateSlot = {
        weekday: normalized.weekday,
        startTime: normalized.startTime,
        endTime: normalized.endTime,
        effectiveFrom: normalized.effectiveFrom ?? today,
        effectiveTo: normalized.effectiveTo ?? null,
      };
      if (hasTimetableConflict(candidate, activeSlots)) {
        const conflictingSlot = findConflictingSlot(candidate, activeSlots)!;
        normalized.conflict = {
          slotId: conflictingSlot.id,
          subject: conflictingSlot.subject,
          startTime: conflictingSlot.startTime,
          endTime: conflictingSlot.endTime,
        };
      } else {
        normalized.conflict = null;
      }
    } else {
      normalized.conflict = null;
    }

    return normalized;
  });
}
