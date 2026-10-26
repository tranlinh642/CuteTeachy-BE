import { Tag as PrismaTag, TagTone as PrismaTagTone } from '@prisma/client';
import { Tag } from '../../../../domain/tag/tag.entity';
import { TagTone } from '../../../../domain/tag/tag-tone.vo';

export class TagMapper {
  static toDomain(raw: PrismaTag): Tag {
    return Tag.reconstitute({
      id: raw.id,
      accountId: raw.accountId,
      name: raw.name,
      tone: raw.tone as TagTone,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
    });
  }

  static toPrismaCreate(tag: Tag) {
    return {
      id: tag.id,
      accountId: tag.accountId,
      name: tag.name,
      tone: tag.tone as PrismaTagTone,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
      deletedAt: tag.deletedAt,
    };
  }

  static toPrismaUpdate(tag: Tag) {
    return {
      name: tag.name,
      tone: tag.tone as PrismaTagTone,
      updatedAt: tag.updatedAt,
      deletedAt: tag.deletedAt,
    };
  }
}
