import { SyncEnvelope } from '../../domain/shared/sync-envelope';
import { parseAndValidateUpdatedSince } from '../../domain/shared/sync-time';
import type { Clock } from '../shared/ports/clock.port';
import type { TagRepository } from './ports/tag.repository.port';
import { TagDto, toTagDto } from './tag.dto';

export interface ListTagsInput {
  accountId: string;
  updatedSince?: string;
}

export class ListTagsUseCase {
  constructor(
    private readonly tagRepo: TagRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ListTagsInput): Promise<SyncEnvelope<TagDto>> {
    const now = this.clock.now();
    const sinceDate = parseAndValidateUpdatedSince(input.updatedSince, now);

    const result = await this.tagRepo.findByAccount(input.accountId, sinceDate);

    return {
      items: result.items.map(toTagDto),
      deletedIds: result.deletedIds,
      serverTime: now.toISOString(),
    };
  }
}
