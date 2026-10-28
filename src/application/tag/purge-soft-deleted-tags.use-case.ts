import { MAX_SYNC_WINDOW_MS } from '../../domain/shared/sync-time';
import type { Clock } from '../shared/ports/clock.port';
import type { TagRepository } from './ports/tag.repository.port';

export interface PurgeSoftDeletedTagsOutput {
  purgedCount: number;
}

export class PurgeSoftDeletedTagsUseCase {
  constructor(
    private readonly tagRepo: TagRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<PurgeSoftDeletedTagsOutput> {
    const now = this.clock.now();
    const threshold = new Date(now.getTime() - MAX_SYNC_WINDOW_MS);

    const purgedCount = await this.tagRepo.deletePermanentlyBefore(threshold);

    return { purgedCount };
  }
}
