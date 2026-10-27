import { TimetableSlot } from './timetable-slot.entity';

export interface CandidateSlot {
  id?: string;
  weekday: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export function findConflictingSlot(
  candidate: CandidateSlot,
  existingSlots: readonly TimetableSlot[],
): TimetableSlot | null {
  for (const slot of existingSlots) {
    if (slot.isDeleted()) {
      continue;
    }
    if (candidate.id && slot.id === candidate.id) {
      continue;
    }
    if (slot.conflictsWith(candidate)) {
      return slot;
    }
  }
  return null;
}

export function hasTimetableConflict(
  candidate: CandidateSlot,
  existingSlots: readonly TimetableSlot[],
): boolean {
  return findConflictingSlot(candidate, existingSlots) !== null;
}
