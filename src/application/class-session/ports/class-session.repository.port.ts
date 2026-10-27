import { ClassSession } from '../../../domain/class-session/class-session.entity';

export const CLASS_SESSION_REPOSITORY = Symbol('ClassSessionRepository');

export interface ClassSessionRepository {
  findById(id: string): Promise<ClassSession | null>;
  findBySlotAndDate(slotId: string, date: string): Promise<ClassSession | null>;
  findByAccountAndDateRange(
    accountId: string,
    from: string,
    to: string,
  ): Promise<ClassSession[]>;
  save(session: ClassSession): Promise<void>;
}
