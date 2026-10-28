import { Inject, Injectable } from '@nestjs/common';
import { TagRepository } from '../../../../application/tag/ports/tag.repository.port';
import { Tag } from '../../../../domain/tag/tag.entity';
import { PrismaService } from '../prisma.service';
import { TagMapper } from '../mappers/tag.mapper';
import { Prisma } from '@prisma/client';

export type PrismaTagClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PrismaTagRepository implements TagRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaTagClient) {}

  async findById(id: string): Promise<Tag | null> {
    const raw = await this.prisma.tag.findUnique({
      where: { id },
    });
    return raw ? TagMapper.toDomain(raw) : null;
  }

  async findByName(accountId: string, name: string): Promise<Tag | null> {
    const raw = await this.prisma.tag.findFirst({
      where: {
        accountId,
        deletedAt: null,
        name: {
          equals: name.trim(),
          mode: 'insensitive',
        },
      },
    });
    return raw ? TagMapper.toDomain(raw) : null;
  }

  async findByAccount(
    accountId: string,
    updatedSince?: Date,
  ): Promise<{ items: Tag[]; deletedIds: string[] }> {
    if (!updatedSince) {
      const rows = await this.prisma.tag.findMany({
        where: {
          accountId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      });
      return {
        items: rows.map(TagMapper.toDomain),
        deletedIds: [],
      };
    }

    const [itemsRows, deletedRows] = await Promise.all([
      this.prisma.tag.findMany({
        where: {
          accountId,
          deletedAt: null,
          updatedAt: { gte: updatedSince },
        },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.tag.findMany({
        where: {
          accountId,
          deletedAt: { not: null },
          updatedAt: { gte: updatedSince },
        },
        select: { id: true },
      }),
    ]);

    return {
      items: itemsRows.map(TagMapper.toDomain),
      deletedIds: deletedRows.map((r) => r.id),
    };
  }

  async save(tag: Tag): Promise<void> {
    await this.prisma.tag.upsert({
      where: { id: tag.id },
      create: TagMapper.toPrismaCreate(tag),
      update: TagMapper.toPrismaUpdate(tag),
    });
  }

  async validateOwnership(accountId: string, tagIds: string[]): Promise<boolean> {
    if (!tagIds || tagIds.length === 0) {
      return true;
    }
    const uniqueIds = Array.from(new Set(tagIds));
    const count = await this.prisma.tag.count({
      where: {
        id: { in: uniqueIds },
        accountId,
        deletedAt: null,
      },
    });
    return count === uniqueIds.length;
  }

  async deletePermanentlyBefore(threshold: Date): Promise<number> {
    const result = await this.prisma.tag.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lte: threshold,
        },
      },
    });
    return result.count;
  }
}
