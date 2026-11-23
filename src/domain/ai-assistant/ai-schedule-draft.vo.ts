import { ScheduleCategory, isScheduleCategory } from '../timetable/schedule-category.vo';
import { Tone, isTone } from '../timetable/tone.vo';
import { AiAssistantValidationError } from './ai-assistant.errors';

export const AI_DRAFT_ITEM_KINDS = ['timetable_slot', 'class_session', 'task'] as const;
export type AiDraftItemKind = (typeof AI_DRAFT_ITEM_KINDS)[number];

export function isAiDraftItemKind(value: unknown): value is AiDraftItemKind {
  return (
    typeof value === 'string' &&
    (AI_DRAFT_ITEM_KINDS as readonly string[]).includes(value)
  );
}

export const AI_CONFLICT_STRATEGIES = ['replace_conflicts', 'skip_conflicts'] as const;
export type AiConflictStrategy = (typeof AI_CONFLICT_STRATEGIES)[number];

export function isAiConflictStrategy(value: unknown): value is AiConflictStrategy {
  return (
    typeof value === 'string' &&
    (AI_CONFLICT_STRATEGIES as readonly string[]).includes(value)
  );
}

export interface AiScheduleDraftConflict {
  slotId: string;
  subject: string;
  startTime: string;
  endTime: string;
}

export interface AiScheduleDraftSummary {
  createdCount: number;
  replacedCount: number;
  skippedCount: number;
}

export interface AiScheduleDraftItem {
  id: string;
  kind: AiDraftItemKind;
  category: ScheduleCategory;
  titleOrSubject: string;
  grade?: string | null;
  room?: string | null;
  weekday?: number | null; // 1..7 cho timetable_slot
  date?: string | null; // YYYY-MM-DD cho class_session hoặc task
  startTime?: string | null; // HH:mm
  endTime?: string | null; // HH:mm (cho timetable_slot / class_session)
  effectiveFrom?: string | null; // YYYY-MM-DD cho timetable_slot
  effectiveTo?: string | null;
  tone?: Tone;
  notes?: string | null;
  conflict?: AiScheduleDraftConflict | null;
}

export interface AiScheduleDraft {
  status: 'pending' | 'applied';
  appliedAt?: string | null;
  conflictStrategy?: AiConflictStrategy | null;
  summary?: AiScheduleDraftSummary | null;
  items: AiScheduleDraftItem[];
}

export function validateAiScheduleDraftItem(item: AiScheduleDraftItem): AiScheduleDraftItem {
  if (!item || typeof item !== 'object') {
    throw new AiAssistantValidationError('Draft item must be an object');
  }
  if (!item.id || typeof item.id !== 'string' || item.id.trim().length === 0) {
    throw new AiAssistantValidationError('Draft item id is required');
  }
  if (!isAiDraftItemKind(item.kind)) {
    throw new AiAssistantValidationError(
      'Draft item kind must be timetable_slot, class_session, or task',
    );
  }
  const category = item.category ?? 'school_teaching';
  if (!isScheduleCategory(category)) {
    throw new AiAssistantValidationError(
      'Draft item category must be school_teaching, extra_teaching, or self_study',
    );
  }
  if (
    !item.titleOrSubject ||
    typeof item.titleOrSubject !== 'string' ||
    item.titleOrSubject.trim().length === 0
  ) {
    throw new AiAssistantValidationError('Draft item titleOrSubject is required');
  }
  if (item.tone !== undefined && item.tone !== null && !isTone(item.tone)) {
    throw new AiAssistantValidationError('Draft item tone is invalid');
  }

  return {
    id: item.id.trim(),
    kind: item.kind,
    category,
    titleOrSubject: item.titleOrSubject.trim(),
    grade: item.grade ?? null,
    room: item.room ?? null,
    weekday: item.weekday ?? null,
    date: item.date ?? null,
    startTime: item.startTime ?? null,
    endTime: item.endTime ?? null,
    effectiveFrom: item.effectiveFrom ?? null,
    effectiveTo: item.effectiveTo ?? null,
    tone: item.tone ?? 'blue',
    notes: item.notes ?? null,
    conflict: item.conflict ?? null,
  };
}

export {
  computeContextDateWindow,
  enrichDraftItemsWithConflicts,
} from './ai-draft-enricher';
