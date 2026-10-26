import {
  TransactionalRepositories,
  UnitOfWork,
} from '../../src/application/shared/ports/unit-of-work.port';
import { FakeTagRepository } from '../unit/application/tag/fake-tag.repository';
import { FakeTaskRepository } from '../unit/application/task/fake-task.repository';
import { FakeNoteRepository } from '../unit/application/note/fake-note.repository';

export class FakeUnitOfWork implements UnitOfWork {
  constructor(
    private readonly repos: {
      tagRepo: FakeTagRepository;
      taskRepo: FakeTaskRepository;
      noteRepo: FakeNoteRepository;
    },
  ) {}

  async run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    const tagSnapshot = this.repos.tagRepo.snapshot();
    const taskSnapshot = this.repos.taskRepo.snapshot();
    const noteSnapshot = this.repos.noteRepo.snapshot();

    try {
      return await work(this.repos);
    } catch (error) {
      this.repos.tagRepo.restore(tagSnapshot);
      this.repos.taskRepo.restore(taskSnapshot);
      this.repos.noteRepo.restore(noteSnapshot);
      throw error;
    }
  }
}
