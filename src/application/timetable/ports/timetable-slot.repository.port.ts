import { TimetableSlot } from '../../../domain/timetable/timetable-slot.entity';

export const TIMETABLE_SLOT_REPOSITORY = Symbol('TIMETABLE_SLOT_REPOSITORY');

export interface TimetableSlotRepository {
  findById(id: string): Promise<TimetableSlot | null>;
  save(slot: TimetableSlot): Promise<void>;
  findByAccount(
    accountId: string,
    updatedSince?: Date,
  ): Promise<{ items: TimetableSlot[]; deletedIds: string[] }>;
  findActiveByAccount(accountId: string): Promise<TimetableSlot[]>;
}
