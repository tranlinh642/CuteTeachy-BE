import type { Tag } from '../../domain/tag/tag.entity';
import type { TagTone } from '../../domain/tag/tag-tone.vo';

export interface TagDto {
  id: string;
  name: string;
  tone: TagTone;
  createdAt: string;
  updatedAt: string;
}

export function toTagDto(tag: Tag): TagDto {
  return {
    id: tag.id,
    name: tag.name,
    tone: tag.tone,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
  };
}
