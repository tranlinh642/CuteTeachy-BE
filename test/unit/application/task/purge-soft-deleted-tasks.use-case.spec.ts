import { PurgeSoftDeletedTasksUseCase } from '../../../../src/application/task/purge-soft-deleted-tasks.use-case';
import { Task } from '../../../../src/domain/task/task.entity';
import { FixedClock } from '../../../fakes/fixed-clock';
import { FakeTaskRepository } from './fake-task.repository';

describe('PurgeSoftDeletedTasksUseCase', () => {
  let taskRepo: FakeTaskRepository;
  let clock: FixedClock;
  let useCase: PurgeSoftDeletedTasksUseCase;

  const now = new Date('2026-10-26T12:00:00.000Z');
  const accountId = 'acc-1';

  beforeEach(() => {
    taskRepo = new FakeTaskRepository();
    clock = new FixedClock(now);
    useCase = new PurgeSoftDeletedTasksUseCase(taskRepo, clock);
  });

  it('purges soft-deleted tasks deleted more than 30 days ago, keeping recent and active tasks', async () => {
    // 1. Task deleted 35 days ago (should be purged)
    const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
    const oldDeletedTask = Task.reconstitute({
      id: 'task-old-deleted',
      accountId,
      title: 'Task deleted 35 days ago',
      notes: null,
      date: '2026-09-20',
      time: null,
      category: 'school',
      priority: 'normal',
      completed: false,
      tagIds: [],
      createdAt: thirtyFiveDaysAgo,
      updatedAt: thirtyFiveDaysAgo,
      deletedAt: thirtyFiveDaysAgo,
    });
    await taskRepo.save(oldDeletedTask);

    // 2. Task deleted 10 days ago (should NOT be purged)
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const recentDeletedTask = Task.reconstitute({
      id: 'task-recent-deleted',
      accountId,
      title: 'Task deleted 10 days ago',
      notes: null,
      date: '2026-10-16',
      time: null,
      category: 'school',
      priority: 'normal',
      completed: false,
      tagIds: [],
      createdAt: tenDaysAgo,
      updatedAt: tenDaysAgo,
      deletedAt: tenDaysAgo,
    });
    await taskRepo.save(recentDeletedTask);

    // 3. Active task created 40 days ago (should NOT be purged)
    const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
    const activeTask = Task.reconstitute({
      id: 'task-active',
      accountId,
      title: 'Active task',
      notes: null,
      date: '2026-09-15',
      time: null,
      category: 'school',
      priority: 'normal',
      completed: false,
      tagIds: [],
      createdAt: fortyDaysAgo,
      updatedAt: fortyDaysAgo,
      deletedAt: null,
    });
    await taskRepo.save(activeTask);

    const result = await useCase.execute();

    expect(result.purgedCount).toBe(1);
    expect(await taskRepo.findById('task-old-deleted')).toBeNull();
    expect(await taskRepo.findById('task-recent-deleted')).not.toBeNull();
    expect(await taskRepo.findById('task-active')).not.toBeNull();
  });
});
