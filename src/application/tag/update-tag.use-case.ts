import { TagTone } from '../../domain/tag/tag-tone.vo';
import { TagNameTakenError } from '../../domain/tag/tag.errors';
import { EntityNotFoundError } from '../../domain/shared/sync.errors';
import type { Clock } from '../shared/ports/clock.port';
import type { TagRepository } from './ports/tag.repository.port';
import { TagDto, toTagDto } from './tag.dto';

export interface UpdateTagInput {
  id: string;
  accountId: string;
  name?: string;
  tone?: TagTone;
}

export class UpdateTagUseCase {
  constructor(
    private readonly tagRepo: TagRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateTagInput): Promise<TagDto> {
    const tag = await this.tagRepo.findById(input.id);

    if (!tag || tag.accountId !== input.accountId || tag.isDeleted()) {
      throw new EntityNotFoundError('Tag not found');
    }

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      const existingByName = await this.tagRepo.findByName(input.accountId, trimmedName);
      if (existingByName && existingByName.id !== tag.id && !existingByName.isDeleted()) {
        throw new TagNameTakenError();
      }
    }

    tag.update({
      name: input.name,
      tone: input.tone,
      now: this.clock.now(),
    });

    await this.tagRepo.save(tag);

    return toTagDto(tag);
  }
}
