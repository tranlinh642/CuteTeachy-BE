import { SyncEnvelope } from '../../domain/shared/sync-envelope';
import { parseAndValidateUpdatedSince } from '../../domain/shared/sync-time';
import type { Clock } from '../shared/ports/clock.port';
import type { TimetableSlotRepository } from './ports/timetable-slot.repository.port';
import { TimetableSlotDto, toTimetableSlotDto } from './timetable-slot.dto';

export interface ListTimetableSlotsInput {
  accountId: string;
  updatedSince?: string;
}

export class ListTimetableSlotsUseCase {
  constructor(
    private readonly slotRepo: TimetableSlotRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ListTimetableSlotsInput): Promise<SyncEnvelope<TimetableSlotDto>> {
    const now = this.clock.now();
    const sinceDate = parseAndValidateUpdatedSince(input.updatedSince, now);

    const result = await this.slotRepo.findByAccount(input.accountId, sinceDate);

    return {
      items: result.items.map(toTimetableSlotDto),
      deletedIds: result.deletedIds,
      serverTime: now.toISOString(),
    };
  }
}
