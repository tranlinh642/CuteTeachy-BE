import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NoteReminderReader } from '../../../../application/reminder/ports/note-reminder.port';
import { Note } from '../../../../domain/note/note.entity';
import { NoteMapper } from '../mappers/note.mapper';

@Injectable()
export class PrismaNoteReminderReader implements NoteReminderReader {
  constructor(private readonly prisma: PrismaService) {}

  async findUpcomingNotes(fromDate?: string, toDate?: string): Promise<Note[]> {
    const now = new Date();
    const effectiveFrom =
      fromDate ?? new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const effectiveTo =
      toDate ?? new Date(now.getTime() + 38 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const rawNotes = await this.prisma.note.findMany({
      where: {
        completed: false,
        deletedAt: null,
        dueDate: {
          not: null,
          gte: effectiveFrom,
          lte: `${effectiveTo}T23:59:59.999Z`,
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
