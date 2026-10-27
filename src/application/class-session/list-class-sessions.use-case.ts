import { SyncEnvelope } from '../../domain/shared/sync-envelope';
import { parseAndValidateUpdatedSince } from '../../domain/shared/sync-time';
import { ClassSessionDateRange } from '../../domain/class-session/date-range.vo';
import {
  enumerateDates,
  generateClassSessions,
  getWeekdayFromIsoDate,
} from '../../domain/class-session/class-session-generator';
import type { Clock } from '../shared/ports/clock.port';
import type { TimetableSlotRepository } from '../timetable/ports/timetable-slot.repository.port';
import type { ClassSessionRepository } from './ports/class-session.repository.port';
import { ClassSession } from '../../domain/class-session/class-session.entity';
import { TimetableSlot } from '../../domain/timetable/timetable-slot.entity';
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
    const sinceDate = parseAndValidateUpdatedSince(input.updatedSince, now);

    if (!sinceDate) {
      return this.executeFull(input.accountId, range, now);
    }

    return this.executeDelta(input.accountId, range, sinceDate, now);
  }

  private async executeFull(
    accountId: string,
    range: ClassSessionDateRange,
    now: Date,
  ): Promise<SyncEnvelope<ClassSessionDto>> {
    const activeSlots = await this.slotRepo.findActiveByAccount(accountId);
    const generatedSessions = generateClassSessions(activeSlots, range.from, range.to);

    const dbSessions = await this.sessionRepo.findByAccountAndDateRange(
      accountId,
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

    this.sortItems(items);

    return {
      items,
      deletedIds: [],
      serverTime: now.toISOString(),
    };
  }

  private async executeDelta(
    accountId: string,
    range: ClassSessionDateRange,
    sinceDate: Date,
    now: Date,
  ): Promise<SyncEnvelope<ClassSessionDto>> {
    const slotChanges = await this.slotRepo.findByAccount(accountId, sinceDate);

    const changedActiveSlots = slotChanges.items.filter(
      (s) => s.updatedAt.getTime() > sinceDate.getTime(),
    );

    const changedDeletedSlots: TimetableSlot[] = [];
    for (const deletedSlotId of slotChanges.deletedIds) {
      const slot = await this.slotRepo.findById(deletedSlotId);
      if (slot && slot.updatedAt.getTime() > sinceDate.getTime()) {
        changedDeletedSlots.push(slot);
      }
    }

    const hasSlotChanged = changedActiveSlots.length > 0 || changedDeletedSlots.length > 0;

    const dbSessions = await this.sessionRepo.findByAccountAndDateRange(
      accountId,
      range.from,
      range.to,
    );

    if (hasSlotChanged) {
      return this.executeDeltaWithSlotChanges(
        accountId,
        range,
        sinceDate,
        now,
        changedActiveSlots,
        changedDeletedSlots,
        dbSessions,
      );
    }

    return this.executeDeltaWithoutSlotChanges(
      accountId,
      sinceDate,
      now,
      dbSessions,
    );
  }

  private async executeDeltaWithoutSlotChanges(
    accountId: string,
    sinceDate: Date,
    now: Date,
    dbSessions: ClassSession[],
  ): Promise<SyncEnvelope<ClassSessionDto>> {
    const items: ClassSessionDto[] = [];
    const deletedIds: string[] = [];
    const slotCache = new Map<string, TimetableSlot | null>();

    for (const session of dbSessions) {
      if (session.isAdHoc()) {
        if (session.isDeleted()) {
          if (session.updatedAt.getTime() > sinceDate.getTime()) {
            deletedIds.push(session.id);
          }
        } else if (session.updatedAt.getTime() > sinceDate.getTime()) {
          items.push(toClassSessionDto(session));
        }
      } else if (session.isOverride()) {
        if (session.updatedAt.getTime() > sinceDate.getTime()) {
          const slotId = session.timetableSlotId!;
          if (!slotCache.has(slotId)) {
            slotCache.set(slotId, await this.slotRepo.findById(slotId));
          }
          const slot = slotCache.get(slotId);
          if (
            slot &&
            !slot.isDeleted() &&
            slot.weekday === getWeekdayFromIsoDate(session.date) &&
            slot.effectiveFrom <= session.date &&
            (slot.effectiveTo === null || session.date <= slot.effectiveTo)
          ) {
            const dto: ClassSessionDto = {
              id: session.id,
              timetableSlotId: slot.id,
              date: session.date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              subject: slot.subject,
              tone: slot.tone,
              prepItems: session.prepItems.map((p) => ({
                id: p.id,
                label: p.label,
                done: p.done,
              })),
              cancelled: session.cancelled,
              updatedAt: session.updatedAt.toISOString(),
            };
            if (slot.grade !== null) {
              dto.grade = slot.grade;
            }
            if (slot.room !== null) {
              dto.room = slot.room;
            }
            if (session.topic !== null) {
              dto.topic = session.topic;
            }
            items.push(dto);
          }
        }
      }
    }

    this.sortItems(items);

    return {
      items,
      deletedIds: Array.from(new Set(deletedIds)).sort(),
      serverTime: now.toISOString(),
    };
  }

  private async executeDeltaWithSlotChanges(
    accountId: string,
    range: ClassSessionDateRange,
    sinceDate: Date,
    now: Date,
    changedActiveSlots: TimetableSlot[],
    changedDeletedSlots: TimetableSlot[],
    dbSessions: ClassSession[],
  ): Promise<SyncEnvelope<ClassSessionDto>> {
    const activeSlots = await this.slotRepo.findActiveByAccount(accountId);
    const generatedSessions = generateClassSessions(activeSlots, range.from, range.to);
    const currentGeneratedSessionIds = new Set(generatedSessions.map((s) => s.id));

    const overrides = new Map<string, ClassSession>();
    const activeAdHocs: ClassSession[] = [];
    const deletedSessionIds: string[] = [];

    for (const session of dbSessions) {
      if (session.isOverride()) {
        if (session.isDeleted()) {
          if (session.updatedAt.getTime() > sinceDate.getTime()) {
            deletedSessionIds.push(session.id);
          }
        } else if (!currentGeneratedSessionIds.has(session.id)) {
          deletedSessionIds.push(session.id);
        } else {
          overrides.set(session.id, session);
        }
      } else if (session.isAdHoc()) {
        if (session.isDeleted()) {
          if (session.updatedAt.getTime() > sinceDate.getTime()) {
            deletedSessionIds.push(session.id);
          }
        } else {
          activeAdHocs.push(session);
        }
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

    this.sortItems(items);

    const dates = enumerateDates(range.from, range.to);

    // 1. Defunct sessions from soft-deleted slots
    for (const slot of changedDeletedSlots) {
      for (const d of dates) {
        if (getWeekdayFromIsoDate(d) === slot.weekday) {
          const isEffective =
            slot.effectiveFrom <= d && (slot.effectiveTo === null || d <= slot.effectiveTo);
          if (isEffective) {
            const id = `${slot.id}:${d}`;
            if (!currentGeneratedSessionIds.has(id)) {
              deletedSessionIds.push(id);
            }
          }
        }
      }
    }

    // 2. Defunct sessions from active slots that were ended / shortened / split
    for (const slot of changedActiveSlots) {
      if (slot.createdAt.getTime() <= sinceDate.getTime()) {
        for (const d of dates) {
          if (getWeekdayFromIsoDate(d) === slot.weekday) {
            const isOutOfRange =
              d < slot.effectiveFrom || (slot.effectiveTo !== null && d > slot.effectiveTo);
            if (isOutOfRange) {
              const id = `${slot.id}:${d}`;
              if (!currentGeneratedSessionIds.has(id)) {
                deletedSessionIds.push(id);
              }
            }
          }
        }
      }
    }

    return {
      items,
      deletedIds: Array.from(new Set(deletedSessionIds)).sort(),
      serverTime: now.toISOString(),
    };
  }

  private sortItems(items: ClassSessionDto[]): void {
    items.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      const timeCmp = a.startTime.localeCompare(b.startTime);
      if (timeCmp !== 0) return timeCmp;
      return a.id.localeCompare(b.id);
    });
  }
}
