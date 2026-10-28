import { TimetableSlotRepository } from '../../src/application/timetable/ports/timetable-slot.repository.port';
import { TimetableSlot } from '../../src/domain/timetable/timetable-slot.entity';

export class InMemoryTimetableSlotRepository implements TimetableSlotRepository {
  private readonly items = new Map<string, TimetableSlot>();

  async findById(id: string): Promise<TimetableSlot | null> {
    return this.items.get(id) ?? null;
  }

  async save(slot: TimetableSlot): Promise<void> {
    this.items.set(slot.id, slot);
  }

  async findByAccount(
    accountId: string,
    updatedSince?: Date,
  ): Promise<{ items: TimetableSlot[]; deletedIds: string[] }> {
    const all = Array.from(this.items.values()).filter((s) => s.accountId === accountId);

    if (!updatedSince) {
      return {
        items: all.filter((s) => !s.isDeleted()),
        deletedIds: [],
      };
    }

    const items = all.filter((s) => !s.isDeleted() && s.updatedAt >= updatedSince);
    const deletedIds = all
      .filter((s) => s.isDeleted() && s.updatedAt >= updatedSince)
      .map((s) => s.id);

    return { items, deletedIds };
  }

  async findActiveByAccount(accountId: string): Promise<TimetableSlot[]> {
    return Array.from(this.items.values()).filter(
      (s) => s.accountId === accountId && !s.isDeleted(),
    );
  }

  snapshot(): Map<string, TimetableSlot> {
    const snap = new Map<string, TimetableSlot>();
    for (const [id, slot] of this.items.entries()) {
      snap.set(
        id,
        TimetableSlot.rehydrate({
          id: slot.id,
          accountId: slot.accountId,
          weekday: slot.weekday,
          startTime: slot.startTime,
          endTime: slot.endTime,
          subject: slot.subject,
          grade: slot.grade,
          room: slot.room,
          tone: slot.tone,
          effectiveFrom: slot.effectiveFrom,
          effectiveTo: slot.effectiveTo,
          createdAt: slot.createdAt,
          updatedAt: slot.updatedAt,
          deletedAt: slot.deletedAt,
        }),
      );
    }
    return snap;
  }

  restore(snap: Map<string, TimetableSlot>): void {
    this.items.clear();
    for (const [k, v] of snap) {
      this.items.set(k, v);
    }
  }
}
