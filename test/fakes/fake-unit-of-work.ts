import {
  TransactionalRepositories,
  UnitOfWork,
} from '../../src/application/shared/ports/unit-of-work.port';
import { FakeTagRepository } from '../unit/application/tag/fake-tag.repository';
import { FakeTaskRepository } from '../unit/application/task/fake-task.repository';
import { FakeNoteRepository } from '../unit/application/note/fake-note.repository';
import { InMemoryTimetableSlotRepository } from './in-memory-timetable-slot.repository';
import { InMemoryClassSessionRepository } from './in-memory-class-session.repository';

export class FakeUnitOfWork implements UnitOfWork {
  constructor(
    private readonly repos: {
      tagRepo?: FakeTagRepository;
      taskRepo?: FakeTaskRepository;
      noteRepo?: FakeNoteRepository;
      timetableSlotRepo?: InMemoryTimetableSlotRepository;
      classSessionRepo?: InMemoryClassSessionRepository;
    },
  ) {}

  async run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    const tagSnapshot = this.repos.tagRepo?.snapshot();
    const taskSnapshot = this.repos.taskRepo?.snapshot();
    const noteSnapshot = this.repos.noteRepo?.snapshot();
    const slotSnapshot = this.repos.timetableSlotRepo?.snapshot();
    const sessionSnapshot = this.repos.classSessionRepo?.snapshot();

    try {
      return await work(this.repos as TransactionalRepositories);
    } catch (error) {
      if (tagSnapshot && this.repos.tagRepo) this.repos.tagRepo.restore(tagSnapshot);
      if (taskSnapshot && this.repos.taskRepo) this.repos.taskRepo.restore(taskSnapshot);
      if (noteSnapshot && this.repos.noteRepo) this.repos.noteRepo.restore(noteSnapshot);
      if (slotSnapshot && this.repos.timetableSlotRepo)
        this.repos.timetableSlotRepo.restore(slotSnapshot);
      if (sessionSnapshot && this.repos.classSessionRepo)
        this.repos.classSessionRepo.restore(sessionSnapshot);
      throw error;
    }
  }
}
