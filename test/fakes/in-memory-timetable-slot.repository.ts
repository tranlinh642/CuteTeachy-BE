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
}
