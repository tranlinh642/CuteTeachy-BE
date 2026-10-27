import { SyncEnvelope } from '../../domain/shared/sync-envelope';
import { parseAndValidateUpdatedSince } from '../../domain/shared/sync-time';
import { ClassSessionDateRange } from '../../domain/class-session/date-range.vo';
import { generateClassSessions } from '../../domain/class-session/class-session-generator';
import type { Clock } from '../shared/ports/clock.port';
import type { TimetableSlotRepository } from '../timetable/ports/timetable-slot.repository.port';
import { ClassSessionDto } from './class-session.dto';

export interface ListClassSessionsInput {
  accountId: string;
  from: string;
  to: string;
  updatedSince?: string;
}

export class ListClassSessionsUseCase {
  constructor(
    private readonly slotRepo: TimetableSlotRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ListClassSessionsInput): Promise<SyncEnvelope<ClassSessionDto>> {
    const range = ClassSessionDateRange.create(input.from, input.to);
    const now = this.clock.now();
    parseAndValidateUpdatedSince(input.updatedSince, now);

    const activeSlots = await this.slotRepo.findActiveByAccount(input.accountId);
    const sessions = generateClassSessions(activeSlots, range.from, range.to);

    return {
      items: sessions,
      deletedIds: [],
      serverTime: now.toISOString(),
    };
  }
}
