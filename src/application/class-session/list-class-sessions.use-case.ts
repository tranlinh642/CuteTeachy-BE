import { SyncEnvelope } from '../../domain/shared/sync-envelope';
import { parseAndValidateUpdatedSince } from '../../domain/shared/sync-time';
import { ClassSessionDateRange } from '../../domain/class-session/date-range.vo';
import { generateClassSessions } from '../../domain/class-session/class-session-generator';
import type { Clock } from '../shared/ports/clock.port';
import type { TimetableSlotRepository } from '../timetable/ports/timetable-slot.repository.port';
import type { ClassSessionRepository } from './ports/class-session.repository.port';
import { ClassSession } from '../../domain/class-session/class-session.entity';
import { ClassSessionDto, toClassSessionDto } from './class-session.dto';

export interface ListClassSessionsInput {
  accountId: string;
  from: string;
  to: string;
  updatedSince?: string;
}

export class ListClassSessionsUseCase {
  constructor(
    private readonly slotRepo: TimetableSlotRepository,
    private readonly sessionRepo: ClassSessionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ListClassSessionsInput): Promise<SyncEnvelope<ClassSessionDto>> {
    const range = ClassSessionDateRange.create(input.from, input.to);
    const now = this.clock.now();
    parseAndValidateUpdatedSince(input.updatedSince, now);

    const activeSlots = await this.slotRepo.findActiveByAccount(input.accountId);
    const generatedSessions = generateClassSessions(activeSlots, range.from, range.to);

    const dbSessions = await this.sessionRepo.findByAccountAndDateRange(
      input.accountId,
      range.from,
      range.to,
    );

    const overrides = new Map<string, ClassSession>();
    const activeAdHocs: ClassSession[] = [];

    for (const session of dbSessions) {
      if (session.isOverride()) {
        overrides.set(session.id, session);
      } else if (session.isAdHoc() && !session.isDeleted()) {
        activeAdHocs.push(session);
      }
    }

    const items: ClassSessionDto[] = generatedSessions.map((session) => {
      const override = overrides.get(session.id);
      if (!override) {
        return session;
      }

      return {
        ...session,
        topic: override.topic !== null ? override.topic : undefined,
        prepItems: override.prepItems.map((p) => ({
          id: p.id,
          label: p.label,
          done: p.done,
        })),
        cancelled: override.cancelled,
        updatedAt: override.updatedAt.toISOString(),
      };
    });

    for (const adHoc of activeAdHocs) {
      items.push(toClassSessionDto(adHoc));
    }

    items.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      const timeCmp = a.startTime.localeCompare(b.startTime);
      if (timeCmp !== 0) return timeCmp;
      return a.id.localeCompare(b.id);
    });

    return {
      items,
      deletedIds: [],
      serverTime: now.toISOString(),
    };
  }
}
