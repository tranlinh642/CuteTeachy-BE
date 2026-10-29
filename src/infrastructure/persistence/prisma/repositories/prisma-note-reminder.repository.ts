import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  NoteReminderQuery,
  NoteReminderReader,
} from '../../../../application/reminder/ports/note-reminder.port';
import { Note } from '../../../../domain/note/note.entity';
import { NoteMapper } from '../mappers/note.mapper';

@Injectable()
export class PrismaNoteReminderReader implements NoteReminderReader {
  constructor(private readonly prisma: PrismaService) {}

  async findUpcomingNotes(
    fromDateOrQuery: string | NoteReminderQuery,
    toDate?: string,
  ): Promise<Note[]> {
    const query =
      typeof fromDateOrQuery === 'string'
        ? { fromDate: fromDateOrQuery, toDate: toDate ?? fromDateOrQuery }
        : fromDateOrQuery;

    const effectiveFrom = query.fromDate ?? query.date;
    const effectiveTo = query.toDate ?? query.date ?? effectiveFrom;

    const rawNotes = await this.prisma.note.findMany({
      where: {
        completed: false,
        deletedAt: null,
        dueDate: {
          not: null,
          ...(effectiveFrom ? { gte: effectiveFrom } : {}),
          ...(effectiveTo ? { lte: `${effectiveTo}T23:59:59.999Z` } : {}),
        },
      },
      orderBy: [{ dueDate: 'asc' }, { remindTime: 'asc' }],
      include: {
        tags: true,
      },
      take: 200,
    });

    return rawNotes.map((raw) => NoteMapper.toDomain(raw));
  }
}
