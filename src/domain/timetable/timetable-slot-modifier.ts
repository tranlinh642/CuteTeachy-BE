import { TimetableSlot } from './timetable-slot.entity';
import { Tone } from './tone.vo';
import { TimetableValidationError } from './timetable.errors';

export interface ModifySlotInput {
  slot: TimetableSlot;
  today: string;
  yesterday: string;
  newSlotId: string;
  now: Date;
  updates: {
    weekday?: number;
    startTime?: string;
    endTime?: string;
    subject?: string;
    grade?: string | null;
    room?: string | null;
    tone?: Tone;
    effectiveFrom?: string;
    effectiveTo?: string | null;
  };
}

export interface SplitModificationResult {
  type: 'split';
  previous: TimetableSlot;
  current: TimetableSlot;
  overridesAction: 'transfer' | 'discard';
}

export interface InPlaceModificationResult {
  type: 'in_place';
  current: TimetableSlot;
  overridesAction: 'keep' | 'discard';
}

export type SlotModificationResult = SplitModificationResult | InPlaceModificationResult;

export function planSlotModification(input: ModifySlotInput): SlotModificationResult {
  const { slot, today, yesterday, newSlotId, now, updates } = input;

  if (slot.hasPastSessions(today)) {
    // Slot has past sessions (effectiveFrom < today) -> SPLIT
    if (slot.effectiveTo !== null && slot.effectiveTo < today) {
      if (!updates.effectiveTo || updates.effectiveTo < today) {
        throw new TimetableValidationError(
          'cannot modify expired slot without specifying a future effectiveTo',
        );
      }
    }

    const originalEffectiveTo = slot.effectiveTo;
    const oldSlot = slot;
    if (slot.effectiveTo === null || slot.effectiveTo >= yesterday) {
      oldSlot.endAt(yesterday, now);
    }

    const newWeekday = updates.weekday ?? oldSlot.weekday;
    const newStartTime = updates.startTime ?? oldSlot.startTime;
    const newEndTime = updates.endTime ?? oldSlot.endTime;
    const newSubject = updates.subject !== undefined ? updates.subject : oldSlot.subject;
    const newGrade = updates.grade !== undefined ? updates.grade : oldSlot.grade;
    const newRoom = updates.room !== undefined ? updates.room : oldSlot.room;
    const newTone = updates.tone ?? oldSlot.tone;
    const newEffectiveFrom = today; // always today
    const newEffectiveTo =
      updates.effectiveTo !== undefined ? updates.effectiveTo : originalEffectiveTo;

    const newSlot = TimetableSlot.create({
      id: newSlotId,
      accountId: oldSlot.accountId,
      weekday: newWeekday,
      startTime: newStartTime,
      endTime: newEndTime,
      subject: newSubject,
      grade: newGrade,
      room: newRoom,
      tone: newTone,
      effectiveFrom: newEffectiveFrom,
      effectiveTo: newEffectiveTo,
      now,
    });

    const timeOrWeekdayChanged =
      newWeekday !== oldSlot.weekday ||
      newStartTime !== oldSlot.startTime ||
      newEndTime !== oldSlot.endTime;
    const overridesAction: 'transfer' | 'discard' = timeOrWeekdayChanged ? 'discard' : 'transfer';

    return {
      type: 'split',
      previous: oldSlot,
      current: newSlot,
      overridesAction,
    };
  }

  // Slot has no past sessions (effectiveFrom >= today) -> EDIT IN PLACE
  const newWeekday = updates.weekday ?? slot.weekday;
  const newStartTime = updates.startTime ?? slot.startTime;
  const newEndTime = updates.endTime ?? slot.endTime;
  const timeOrWeekdayChanged =
    newWeekday !== slot.weekday ||
    newStartTime !== slot.startTime ||
    newEndTime !== slot.endTime;
  const overridesAction: 'keep' | 'discard' = timeOrWeekdayChanged ? 'discard' : 'keep';

  slot.update({
    ...updates,
    now,
  });

  return {
    type: 'in_place',
    current: slot,
    overridesAction,
  };
}

export interface SlotDeletionResult {
  type: 'ended' | 'deleted' | 'noop';
  slot: TimetableSlot;
}

export function planSlotDeletion(
  slot: TimetableSlot,
  today: string,
  yesterday: string,
  now: Date,
): SlotDeletionResult {
  if (slot.isDeleted()) {
    return { type: 'noop', slot };
  }

  if (slot.hasPastSessions(today)) {
    const targetEffectiveTo =
      slot.effectiveTo !== null && slot.effectiveTo < yesterday ? slot.effectiveTo : yesterday;
    slot.endAt(targetEffectiveTo, now);
    return { type: 'ended', slot };
  }

  slot.delete(now);
  return { type: 'deleted', slot };
}
