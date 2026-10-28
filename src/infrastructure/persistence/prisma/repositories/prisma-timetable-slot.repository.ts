import { Inject, Injectable } from '@nestjs/common';
import { TimetableSlotRepository } from '../../../../application/timetable/ports/timetable-slot.repository.port';
import { TimetableSlot } from '../../../../domain/timetable/timetable-slot.entity';
import { PrismaService } from '../prisma.service';
import { TimetableSlotMapper } from '../mappers/timetable-slot.mapper';
import { Prisma } from '@prisma/client';

export type PrismaTimetableSlotClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PrismaTimetableSlotRepository implements TimetableSlotRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaTimetableSlotClient) {}

  async findById(id: string): Promise<TimetableSlot | null> {
    const raw = await this.prisma.timetableSlot.findUnique({
      where: { id },
    });
    return raw ? TimetableSlotMapper.toDomain(raw) : null;
  }

  async save(slot: TimetableSlot): Promise<void> {
    const data = TimetableSlotMapper.toPrismaCreate(slot);
    await this.prisma.timetableSlot.upsert({
      where: { id: slot.id },
      create: data,
      update: TimetableSlotMapper.toPrismaUpdate(slot),
    });
  }

  async findByAccount(
    accountId: string,
    updatedSince?: Date,
  ): Promise<{ items: TimetableSlot[]; deletedIds: string[] }> {
    if (!updatedSince) {
      const rows = await this.prisma.timetableSlot.findMany({
        where: {
          accountId,
          deletedAt: null,
        },
        orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
      });
      return {
        items: rows.map(TimetableSlotMapper.toDomain),
        deletedIds: [],
      };
    }

    const [itemsRows, deletedRows] = await Promise.all([
      this.prisma.timetableSlot.findMany({
        where: {
          accountId,
          deletedAt: null,
          updatedAt: { gte: updatedSince },
        },
        orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }, { updatedAt: 'asc' }],
      }),
      this.prisma.timetableSlot.findMany({
        where: {
          accountId,
          deletedAt: { not: null },
          updatedAt: { gte: updatedSince },
        },
        select: { id: true },
      }),
    ]);

    return {
      items: itemsRows.map(TimetableSlotMapper.toDomain),
      deletedIds: deletedRows.map((r) => r.id),
    };
  }

  async findActiveByAccount(accountId: string): Promise<TimetableSlot[]> {
    const rows = await this.prisma.timetableSlot.findMany({
      where: {
        accountId,
        deletedAt: null,
      },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
    return rows.map(TimetableSlotMapper.toDomain);
  }
}
