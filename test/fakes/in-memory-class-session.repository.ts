import { ClassSessionRepository } from '../../src/application/class-session/ports/class-session.repository.port';
import { ClassSession } from '../../src/domain/class-session/class-session.entity';

export class InMemoryClassSessionRepository implements ClassSessionRepository {
  private readonly items = new Map<string, ClassSession>();

  async findById(id: string): Promise<ClassSession | null> {
    return this.items.get(id) ?? null;
  }

  async findBySlotAndDate(slotId: string, date: string): Promise<ClassSession | null> {
    for (const session of this.items.values()) {
      if (session.timetableSlotId === slotId && session.date === date) {
        return session;
      }
    }
    return null;
  }

  async findByAccountAndDateRange(
    accountId: string,
    from: string,
    to: string,
  ): Promise<ClassSession[]> {
    return Array.from(this.items.values()).filter(
      (s) => s.accountId === accountId && s.date >= from && s.date <= to,
    );
  }

  async save(session: ClassSession): Promise<void> {
    this.items.set(session.id, session);
  }

  async transferOverrides(
    oldSlotId: string,
    newSlotId: string,
    fromDate: string,
    newEffectiveTo?: string | null,
  ): Promise<void> {
    for (const [id, session] of Array.from(this.items.entries())) {
      if (session.timetableSlotId === oldSlotId && session.date >= fromDate) {
        this.items.delete(id);
        if (newEffectiveTo && session.date > newEffectiveTo) {
          continue;
        }
        const newSession = ClassSession.rehydrate({
          id: `${newSlotId}:${session.date}`,
          accountId: session.accountId,
          timetableSlotId: newSlotId,
          date: session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          subject: session.subject,
          grade: session.grade,
          room: session.room,
          tone: session.tone,
          topic: session.topic,
          prepItems: session.prepItems,
          cancelled: session.cancelled,
          createdAt: session.createdAt,
          updatedAt: new Date(),
          deletedAt: session.deletedAt,
        });
        this.items.set(newSession.id, newSession);
      }
    }
  }

  async deleteOverridesBySlotFromDate(slotId: string, fromDate: string): Promise<void> {
    for (const [id, session] of Array.from(this.items.entries())) {
      if (session.timetableSlotId === slotId && session.date >= fromDate) {
        this.items.delete(id);
      }
    }
  }

  snapshot(): Map<string, ClassSession> {
    return new Map(this.items);
  }

  restore(snap: Map<string, ClassSession>): void {
    this.items.clear();
    for (const [k, v] of snap) {
      this.items.set(k, v);
    }
  }
}
