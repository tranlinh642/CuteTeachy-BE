import { Injectable } from '@nestjs/common';
import {
  FindNotesOptions,
  NoteRepository,
} from '../../../../application/note/ports/note.repository.port';
import { Note } from '../../../../domain/note/note.entity';
import { normalizeVietnamese } from '../../../../domain/note/vietnamese-normalize';
import { NoteCursor } from '../../../../application/note/note.dto';
import { PrismaService } from '../prisma.service';
import { NoteMapper } from '../mappers/note.mapper';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaNoteRepository implements NoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Note | null> {
    const raw = await this.prisma.note.findUnique({
      where: { id },
      include: { tags: true },
    });
    return raw ? NoteMapper.toDomain(raw) : null;
  }

  async findByAccount(
    accountId: string,
    options: FindNotesOptions,
  ): Promise<{ items: Note[]; nextCursor?: NoteCursor }> {
    const where: Prisma.NoteWhereInput = {
      accountId,
      deletedAt: null,
    };

    if (options.tagId) {
      where.tags = {
        some: { tagId: options.tagId },
      };
    }

    if (options.q && options.q.trim() !== '') {
      const normalizedQuery = normalizeVietnamese(options.q);
      where.searchContent = {
        contains: normalizedQuery,
      };
    }

    if (options.cursor) {
      const cursorDate = new Date(options.cursor.updatedAt);
      where.OR = [
        { updatedAt: { lt: cursorDate } },
        {
          updatedAt: cursorDate,
          id: { lt: options.cursor.id },
        },
      ];
    }

    const rows = await this.prisma.note.findMany({
      where,
      include: { tags: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
    });

    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;

    let nextCursor: NoteCursor | undefined;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = {
        updatedAt: last.updatedAt.toISOString(),
        id: last.id,
      };
    }

    return {
      items: items.map(NoteMapper.toDomain),
      nextCursor,
    };
  }

  async findDeltaByAccount(
    accountId: string,
    updatedSince: Date,
  ): Promise<{ items: Note[]; deletedIds: string[] }> {
    const [itemsRows, deletedRows] = await Promise.all([
      this.prisma.note.findMany({
        where: {
          accountId,
          deletedAt: null,
          updatedAt: { gte: updatedSince },
        },
        include: { tags: true },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.note.findMany({
        where: {
          accountId,
          deletedAt: { not: null },
          updatedAt: { gte: updatedSince },
        },
        select: { id: true },
      }),
    ]);

    return {
      items: itemsRows.map(NoteMapper.toDomain),
      deletedIds: deletedRows.map((r) => r.id),
    };
  }

  async save(note: Note): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.note.upsert({
        where: { id: note.id },
        create: NoteMapper.toPrismaCreate(note),
        update: NoteMapper.toPrismaUpdate(note),
      });

      await tx.noteTag.deleteMany({
        where: { noteId: note.id },
      });

      if (note.tagIds.length > 0) {
        await tx.noteTag.createMany({
          data: note.tagIds.map((tagId) => ({
            noteId: note.id,
            tagId,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  async validateTagOwnership(accountId: string, tagIds: string[]): Promise<boolean> {
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
    const result = await this.prisma.note.deleteMany({
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
