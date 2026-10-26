import { Tag } from '../../domain/tag/tag.entity';
import { TagTone } from '../../domain/tag/tag-tone.vo';
import { TagNameTakenError } from '../../domain/tag/tag.errors';
import { checkCreationIdempotency } from '../../domain/shared/sync-idempotency';
import type { Clock } from '../shared/ports/clock.port';
import type { TagRepository } from './ports/tag.repository.port';
import { TagDto, toTagDto } from './tag.dto';

export interface CreateTagInput {
  id: string;
  accountId: string;
  name: string;
  tone: TagTone;
}

export interface CreateTagOutput {
  tag: TagDto;
  created: boolean;
}

export class CreateTagUseCase {
  constructor(
    private readonly tagRepo: TagRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateTagInput): Promise<CreateTagOutput> {
    const existing = await this.tagRepo.findById(input.id);
    const idempotency = checkCreationIdempotency(existing, input.accountId);

    if (idempotency.kind === 'existing') {
      return {
        tag: toTagDto(idempotency.entity),
        created: false,
      };
    }

    const trimmedName = input.name.trim();
    const existingByName = await this.tagRepo.findByName(input.accountId, trimmedName);
    if (existingByName && !existingByName.isDeleted()) {
      throw new TagNameTakenError();
    }

    const tag = Tag.create({
      id: input.id,
      accountId: input.accountId,
      name: trimmedName,
      tone: input.tone,
      now: this.clock.now(),
    });

    await this.tagRepo.save(tag);

    return {
      tag: toTagDto(tag),
      created: true,
    };
  }
}
