import type { TagRepository } from '../../tag/ports/tag.repository.port';
import type { TaskRepository } from '../../task/ports/task.repository.port';
import type { NoteRepository } from '../../note/ports/note.repository.port';
import type { TimetableSlotRepository } from '../../timetable/ports/timetable-slot.repository.port';
import type { ClassSessionRepository } from '../../class-session/ports/class-session.repository.port';

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

export interface TransactionalRepositories {
  tagRepo: TagRepository;
  taskRepo: TaskRepository;
  noteRepo: NoteRepository;
  timetableSlotRepo: TimetableSlotRepository;
  classSessionRepo: ClassSessionRepository;
}

export interface UnitOfWork {
  run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T>;
}
