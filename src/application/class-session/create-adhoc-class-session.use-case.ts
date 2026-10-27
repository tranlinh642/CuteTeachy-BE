import { ClassSession } from '../../domain/class-session/class-session.entity';
import { Tone } from '../../domain/timetable/tone.vo';
import { PayloadConflictError } from '../../domain/class-session/class-session.errors';
import { IdConflictError, EntityGoneError } from '../../domain/shared/sync.errors';
import type { Clock } from '../shared/ports/clock.port';
import type { ClassSessionRepository } from './ports/class-session.repository.port';
import { ClassSessionDto, PrepItemDto, toClassSessionDto } from './class-session.dto';

export interface CreateAdHocClassSessionInput {
  id: string;
  accountId: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  grade?: string | null;
  room?: string | null;
  tone: Tone;
  topic?: string | null;
  prepItems?: PrepItemDto[];
  cancelled?: boolean;
}

export interface CreateAdHocClassSessionOutput {
  session: ClassSessionDto;
  created: boolean;
}

export class CreateAdHocClassSessionUseCase {
  constructor(
    private readonly sessionRepo: ClassSessionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateAdHocClassSessionInput): Promise<CreateAdHocClassSessionOutput> {
    const existing = await this.sessionRepo.findById(input.id);

    if (existing) {
      if (existing.accountId !== input.accountId) {
        throw new IdConflictError('Resource id belongs to another account');
      }

      if (existing.isDeleted()) {
        throw new EntityGoneError('Resource has been deleted');
      }

      const matches = existing.matchesAdHocPayload({
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
      });

      if (!matches) {
        throw new PayloadConflictError('Payload differs from existing resource');
      }

      return {
        session: toClassSessionDto(existing),
        created: false,
      };
    }

    const session = ClassSession.createAdHoc({
      id: input.id,
      accountId: input.accountId,
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

    return {
      session: toClassSessionDto(session),
      created: true,
    };
  }
}
