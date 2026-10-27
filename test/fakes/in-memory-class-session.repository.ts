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
}
