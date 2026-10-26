import { Tag } from '../../../../src/domain/tag/tag.entity';
import { TagRepository } from '../../../../src/application/tag/ports/tag.repository.port';

export class FakeTagRepository implements TagRepository {
  private tags: Map<string, Tag> = new Map();

  async findById(id: string): Promise<Tag | null> {
    return this.tags.get(id) ?? null;
  }

  async findByName(accountId: string, name: string): Promise<Tag | null> {
    const target = name.trim().toLowerCase();
    for (const tag of this.tags.values()) {
      if (tag.accountId === accountId && !tag.isDeleted() && tag.name.toLowerCase() === target) {
        return tag;
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
          items.push(tag);
        }
      } else {
        if (!tag.isDeleted() && tag.updatedAt >= updatedSince) {
          items.push(tag);
        } else if (tag.isDeleted() && tag.updatedAt >= updatedSince) {
          deletedIds.push(tag.id);
        }
      }
    }

    return { items, deletedIds };
  }

  async save(tag: Tag): Promise<void> {
    this.tags.set(tag.id, tag);
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
