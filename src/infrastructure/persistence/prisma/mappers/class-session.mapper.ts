import { ClassSession as PrismaClassSession, Prisma, Tone as PrismaTone } from '@prisma/client';
import { ClassSession } from '../../../../domain/class-session/class-session.entity';
import { PrepItem } from '../../../../domain/class-session/prep-item.vo';
import { Tone } from '../../../../domain/timetable/tone.vo';

export class ClassSessionMapper {
  static toDomain(raw: PrismaClassSession): ClassSession {
    let prepItems: PrepItem[] = [];
    if (Array.isArray(raw.prepItems)) {
      prepItems = (raw.prepItems as unknown as Record<string, unknown>[]).map((item) => ({
        id: String(item.id),
        label: String(item.label),
        done: Boolean(item.done),
      }));
    }

    return ClassSession.rehydrate({
      id: raw.id,
      accountId: raw.accountId,
      timetableSlotId: raw.timetableSlotId,
      date: raw.date,
      startTime: raw.startTime,
      endTime: raw.endTime,
      subject: raw.subject,
      grade: raw.grade,
      room: raw.room,
      tone: (raw.tone as Tone) ?? null,
      topic: raw.topic,
      prepItems,
      cancelled: raw.cancelled,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
    });
  }

  static toPrismaCreate(session: ClassSession): Prisma.ClassSessionUncheckedCreateInput {
    return {
      id: session.id,
      accountId: session.accountId,
      timetableSlotId: session.timetableSlotId,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      subject: session.subject,
      grade: session.grade,
      room: session.room,
      tone: session.tone ? (session.tone as PrismaTone) : null,
      topic: session.topic,
      prepItems: session.prepItems as unknown as Prisma.InputJsonValue,
      cancelled: session.cancelled,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      deletedAt: session.deletedAt,
    };
  }

  static toPrismaUpdate(session: ClassSession): Prisma.ClassSessionUncheckedUpdateInput {
    return {
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      subject: session.subject,
      grade: session.grade,
      room: session.room,
      tone: session.tone ? (session.tone as PrismaTone) : null,
      topic: session.topic,
      prepItems: session.prepItems as unknown as Prisma.InputJsonValue,
      cancelled: session.cancelled,
      updatedAt: session.updatedAt,
      deletedAt: session.deletedAt,
    };
  }
}
