import { ClassSession } from '../../domain/class-session/class-session.entity';
import { getWeekdayFromIsoDate } from '../../domain/class-session/class-session-generator';
import { Tone } from '../../domain/timetable/tone.vo';
import { ClassSessionValidationError } from '../../domain/class-session/class-session.errors';
import { EntityNotFoundError } from '../../domain/shared/sync.errors';
import type { Clock } from '../shared/ports/clock.port';
import type { ClassSessionRepository } from './ports/class-session.repository.port';
import type { TimetableSlotRepository } from '../timetable/ports/timetable-slot.repository.port';
import { ClassSessionDto, PrepItemDto, toClassSessionDto } from './class-session.dto';

export interface UpdateClassSessionInput {
  id: string;
  accountId: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  subject?: string;
  grade?: string | null;
  room?: string | null;
  tone?: Tone;
  topic?: string | null;
  prepItems?: PrepItemDto[];
  cancelled?: boolean;
}

export class UpdateClassSessionUseCase {
  constructor(
    private readonly sessionRepo: ClassSessionRepository,
    private readonly slotRepo: TimetableSlotRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateClassSessionInput): Promise<ClassSessionDto> {
    const isGenerated = input.id.includes(':');

    if (isGenerated) {
      if (
        input.date !== undefined ||
        input.startTime !== undefined ||
        input.endTime !== undefined ||
        input.subject !== undefined ||
        input.grade !== undefined ||
        input.room !== undefined ||
        input.tone !== undefined
      ) {
        throw new ClassSessionValidationError(
          'Generated class session only accepts topic, prepItems, cancelled',
        );
      }

      const colonIdx = input.id.indexOf(':');
      const slotId = input.id.substring(0, colonIdx);
      const sessionDate = input.id.substring(colonIdx + 1);

      const slot = await this.slotRepo.findById(slotId);
      if (!slot || slot.accountId !== input.accountId || slot.isDeleted()) {
        throw new EntityNotFoundError('Class session not found');
      }

      if (getWeekdayFromIsoDate(sessionDate) !== slot.weekday) {
        throw new EntityNotFoundError('Class session not found');
      }

      const isEffective =
        slot.effectiveFrom <= sessionDate &&
        (slot.effectiveTo === null || sessionDate <= slot.effectiveTo);
      if (!isEffective) {
        throw new EntityNotFoundError('Class session not found');
      }

      const now = this.clock.now();
      let override = await this.sessionRepo.findById(input.id);

      if (!override) {
        override = ClassSession.createOverride({
          id: input.id,
          accountId: input.accountId,
          timetableSlotId: slot.id,
          date: sessionDate,
          topic: input.topic,
          prepItems: input.prepItems,
          cancelled: input.cancelled,
          now,
        });
      } else {
        override.updateOverride({
          topic: input.topic,
          prepItems: input.prepItems,
          cancelled: input.cancelled,
          now,
        });
      }

      await this.sessionRepo.save(override);

      const dto: ClassSessionDto = {
        id: input.id,
        timetableSlotId: slot.id,
        date: sessionDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subject: slot.subject,
        tone: slot.tone,
        prepItems: override.prepItems.map((p) => ({
          id: p.id,
          label: p.label,
          done: p.done,
        })),
        cancelled: override.cancelled,
        updatedAt: override.updatedAt.toISOString(),
      };

      if (slot.grade !== null) {
        dto.grade = slot.grade;
      }
      if (slot.room !== null) {
        dto.room = slot.room;
      }
      if (override.topic !== null) {
        dto.topic = override.topic;
      }

      return dto;
    }

    const session = await this.sessionRepo.findById(input.id);
    if (!session || session.accountId !== input.accountId || session.isDeleted()) {
      throw new EntityNotFoundError('Class session not found');
    }

    session.updateAdHoc({
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      subject: input.subject,
      grade: input.grade,
      room: input.room,
      tone: input.tone,
      topic: input.topic,
      prepItems: input.prepItems,
      cancelled: input.cancelled,
      now: this.clock.now(),
    });

    await this.sessionRepo.save(session);

    return toClassSessionDto(session);
  }
}
