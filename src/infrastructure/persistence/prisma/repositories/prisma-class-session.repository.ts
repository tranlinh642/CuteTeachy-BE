import { Inject, Injectable } from '@nestjs/common';
import { ClassSessionRepository } from '../../../../application/class-session/ports/class-session.repository.port';
import { ClassSession } from '../../../../domain/class-session/class-session.entity';
import { PrismaService } from '../prisma.service';
import { ClassSessionMapper } from '../mappers/class-session.mapper';
import { Prisma } from '@prisma/client';

export type PrismaClassSessionClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PrismaClassSessionRepository implements ClassSessionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaClassSessionClient) {}

  async findById(id: string): Promise<ClassSession | null> {
    const raw = await this.prisma.classSession.findUnique({
      where: { id },
    });
    return raw ? ClassSessionMapper.toDomain(raw) : null;
  }

  async findBySlotAndDate(slotId: string, date: string): Promise<ClassSession | null> {
    const raw = await this.prisma.classSession.findFirst({
      where: {
        timetableSlotId: slotId,
        date,
      },
    });
    return raw ? ClassSessionMapper.toDomain(raw) : null;
  }

  async findByAccountAndDateRange(
    accountId: string,
    from: string,
    to: string,
  ): Promise<ClassSession[]> {
    const rows = await this.prisma.classSession.findMany({
      where: {
        accountId,
        date: {
          gte: from,
          lte: to,
        },
      },
    });
    return rows.map(ClassSessionMapper.toDomain);
  }

  async save(session: ClassSession): Promise<void> {
    const data = ClassSessionMapper.toPrismaCreate(session);
    await this.prisma.classSession.upsert({
      where: { id: session.id },
      create: data,
      update: ClassSessionMapper.toPrismaUpdate(session),
    });
  }

  async transferOverrides(
    oldSlotId: string,
    newSlotId: string,
    fromDate: string,
    newEffectiveTo?: string | null,
  ): Promise<void> {
    const overrides = await this.prisma.classSession.findMany({
      where: {
        timetableSlotId: oldSlotId,
        date: { gte: fromDate },
      },
    });

    for (const override of overrides) {
      await this.prisma.classSession.delete({
        where: { id: override.id },
      });

      if (newEffectiveTo && override.date > newEffectiveTo) {
        continue;
      }

      await this.prisma.classSession.create({
        data: {
          id: `${newSlotId}:${override.date}`,
          accountId: override.accountId,
          timetableSlotId: newSlotId,
          date: override.date,
          startTime: override.startTime,
          endTime: override.endTime,
          subject: override.subject,
          grade: override.grade,
          room: override.room,
          tone: override.tone,
          topic: override.topic,
          prepItems: override.prepItems ?? [],
          cancelled: override.cancelled,
          createdAt: override.createdAt,
          updatedAt: new Date(),
          deletedAt: override.deletedAt,
        },
      });
    }
  }

  async deleteOverridesBySlotFromDate(slotId: string, fromDate: string): Promise<void> {
    await this.prisma.classSession.deleteMany({
      where: {
        timetableSlotId: slotId,
        date: { gte: fromDate },
      },
    });
  }
}
