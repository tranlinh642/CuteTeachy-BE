import type { Tag } from '../../../domain/tag/tag.entity';

export const TAG_REPOSITORY = Symbol('TAG_REPOSITORY');

export interface TagRepository {
  findById(id: string): Promise<Tag | null>;
  findByName(accountId: string, name: string): Promise<Tag | null>;
  findByAccount(
    accountId: string,
    updatedSince?: Date,
  ): Promise<{
    items: Tag[];
    deletedIds: string[];
  }>;
  save(tag: Tag): Promise<void>;
  deletePermanentlyBefore(threshold: Date): Promise<number>;
}
