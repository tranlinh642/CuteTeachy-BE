import { Inject, Injectable } from '@nestjs/common';
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

export type PrismaNoteClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PrismaNoteRepository implements NoteRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaNoteClient) {}

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
    const runInTx = async (tx: PrismaNoteClient) => {
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
    };

    if ('$transaction' in this.prisma && typeof (this.prisma as any).$transaction === 'function') {
      await (this.prisma as PrismaService).$transaction(async (tx) => runInTx(tx));
    } else {
      await runInTx(this.prisma);
    }
  }

  async unlinkTag(accountId: string, tagId: string, now: Date): Promise<number> {
    const matching = await this.prisma.noteTag.findMany({
      where: {
        tagId,
        note: { accountId },
      },
      select: { noteId: true },
    });

    if (matching.length === 0) {
      return 0;
    }

    const noteIds = matching.map((m) => m.noteId);

    await this.prisma.noteTag.deleteMany({
      where: {
        tagId,
        noteId: { in: noteIds },
      },
    });

    await this.prisma.note.updateMany({
      where: {
        id: { in: noteIds },
      },
      data: {
        updatedAt: now,
      },
    });

    return noteIds.length;
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
