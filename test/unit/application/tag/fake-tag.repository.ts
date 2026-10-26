import { Tag } from '../../../../src/domain/tag/tag.entity';
import { TagRepository } from '../../../../src/application/tag/ports/tag.repository.port';

function cloneTag(tag: Tag): Tag {
  return Tag.reconstitute({
    id: tag.id,
    accountId: tag.accountId,
    name: tag.name,
    tone: tag.tone,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
    deletedAt: tag.deletedAt ?? null,
  });
}

export class FakeTagRepository implements TagRepository {
  private tags: Map<string, Tag> = new Map();

  snapshot(): Map<string, Tag> {
    const copy = new Map<string, Tag>();
    for (const [id, tag] of this.tags.entries()) {
      copy.set(id, cloneTag(tag));
    }
    return copy;
  }

  restore(snapshot: Map<string, Tag>): void {
    this.tags = new Map();
    for (const [id, tag] of snapshot.entries()) {
      this.tags.set(id, cloneTag(tag));
    }
  }

  async findById(id: string): Promise<Tag | null> {
    const tag = this.tags.get(id);
    return tag ? cloneTag(tag) : null;
  }

  async findByName(accountId: string, name: string): Promise<Tag | null> {
    const target = name.trim().toLowerCase();
    for (const tag of this.tags.values()) {
      if (tag.accountId === accountId && !tag.isDeleted() && tag.name.toLowerCase() === target) {
        return cloneTag(tag);
      }
    }
    return null;
  }

  async findByAccount(
    accountId: string,
    updatedSince?: Date,
  ): Promise<{ items: Tag[]; deletedIds: string[] }> {
    const items: Tag[] = [];
    const deletedIds: string[] = [];

    for (const tag of this.tags.values()) {
      if (tag.accountId !== accountId) continue;

      if (!updatedSince) {
        if (!tag.isDeleted()) {
          items.push(cloneTag(tag));
        }
      } else {
        if (!tag.isDeleted() && tag.updatedAt >= updatedSince) {
          items.push(cloneTag(tag));
        } else if (tag.isDeleted() && tag.updatedAt >= updatedSince) {
          deletedIds.push(tag.id);
        }
      }
    }

    return { items, deletedIds };
  }

  async save(tag: Tag): Promise<void> {
    this.tags.set(tag.id, cloneTag(tag));
  }

  async validateOwnership(accountId: string, tagIds: string[]): Promise<boolean> {
    if (!tagIds || tagIds.length === 0) {
      return true;
    }
    const uniqueIds = Array.from(new Set(tagIds));
    for (const id of uniqueIds) {
      const tag = this.tags.get(id);
      if (!tag || tag.accountId !== accountId || tag.isDeleted()) {
        return false;
      }
    }
    return true;
  }

  async deletePermanentlyBefore(threshold: Date): Promise<number> {
    let count = 0;
    for (const [id, tag] of Array.from(this.tags.entries())) {
      if (tag.deletedAt && tag.deletedAt <= threshold) {
        this.tags.delete(id);
        count++;
      }
    }
    return count;
  }
}
