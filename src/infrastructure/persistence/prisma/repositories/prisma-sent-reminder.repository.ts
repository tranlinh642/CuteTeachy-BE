import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SentReminderRepository } from '../../../../application/reminder/ports/sent-reminder.repository.port';
import { SentReminder } from '../../../../domain/reminder/sent-reminder.entity';
import { ReminderType } from '../../../../domain/reminder/reminder-type.vo';
import { SentReminderMapper } from '../mappers/sent-reminder.mapper';

@Injectable()
export class PrismaSentReminderRepository implements SentReminderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(reminder: SentReminder): Promise<void> {
    const data = SentReminderMapper.toPrismaCreate(reminder);
    await this.prisma.sentReminder.upsert({
      where: {
        type_targetId_remindAt: {
          type: data.type,
          targetId: data.targetId,
          remindAt: data.remindAt,
        },
      },
      create: data,
      update: {},
    });
  }

  async exists(type: ReminderType, targetId: string, remindAt: Date): Promise<boolean> {
    const record = await this.prisma.sentReminder.findUnique({
      where: {
        type_targetId_remindAt: {
          type,
          targetId,
          remindAt,
        },
      },
      select: { id: true },
    });
    return record !== null;
  }

  async deletePermanentlyBefore(threshold: Date): Promise<number> {
    const result = await this.prisma.sentReminder.deleteMany({
      where: {
        sentAt: {
          lt: threshold,
        },
      },
    });
    return result.count;
  }
}
