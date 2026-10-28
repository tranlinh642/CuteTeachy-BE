import { TimetableSlot as PrismaTimetableSlot, Tone as PrismaTone } from '@prisma/client';
import { TimetableSlot } from '../../../../domain/timetable/timetable-slot.entity';
import { Tone } from '../../../../domain/timetable/tone.vo';

export class TimetableSlotMapper {
  static toDomain(raw: PrismaTimetableSlot): TimetableSlot {
    return TimetableSlot.rehydrate({
      id: raw.id,
      accountId: raw.accountId,
      weekday: raw.weekday,
      startTime: raw.startTime,
      endTime: raw.endTime,
      subject: raw.subject,
      grade: raw.grade,
      room: raw.room,
      tone: raw.tone as Tone,
      effectiveFrom: raw.effectiveFrom,
      effectiveTo: raw.effectiveTo,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
    });
  }

  static toPrismaCreate(slot: TimetableSlot) {
    return {
      id: slot.id,
      accountId: slot.accountId,
      weekday: slot.weekday,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subject: slot.subject,
      grade: slot.grade,
      room: slot.room,
      tone: slot.tone as PrismaTone,
      effectiveFrom: slot.effectiveFrom,
      effectiveTo: slot.effectiveTo,
      createdAt: slot.createdAt,
      updatedAt: slot.updatedAt,
      deletedAt: slot.deletedAt,
    };
  }

  static toPrismaUpdate(slot: TimetableSlot) {
    return {
      weekday: slot.weekday,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subject: slot.subject,
      grade: slot.grade,
      room: slot.room,
      tone: slot.tone as PrismaTone,
      effectiveFrom: slot.effectiveFrom,
      effectiveTo: slot.effectiveTo,
      updatedAt: slot.updatedAt,
      deletedAt: slot.deletedAt,
    };
  }
}
