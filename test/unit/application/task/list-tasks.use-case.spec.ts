import { ListTasksUseCase } from '../../../../src/application/task/list-tasks.use-case';
import { Task } from '../../../../src/domain/task/task.entity';
import { TaskValidationError } from '../../../../src/domain/task/task.errors';
import { SyncValidationError } from '../../../../src/domain/shared/sync.errors';
import { FixedClock } from '../../../fakes/fixed-clock';
import { FakeTaskRepository } from './fake-task.repository';

describe('ListTasksUseCase', () => {
  let taskRepo: FakeTaskRepository;
  let clock: FixedClock;
  let useCase: ListTasksUseCase;

  const now = new Date('2026-10-26T12:00:00.000Z');
  const accountId = 'acc-1';
  const otherAccountId = 'acc-2';

  beforeEach(() => {
    taskRepo = new FakeTaskRepository();
    clock = new FixedClock(now);
    useCase = new ListTasksUseCase(taskRepo, clock);
  });

  it('lists tasks in date range [from, to] without updatedSince', async () => {
    const task1 = Task.create({
      id: '11111111-1111-4111-8111-111111111111',
      accountId,
      title: 'Task in range',
      date: '2026-10-15',
      category: 'school',
      now,
    });
    const taskOutside = Task.create({
      id: '22222222-2222-4222-8222-222222222222',
      accountId,
      title: 'Task outside range',
      date: '2026-11-20',
      category: 'school',
      now,
    });
    const otherUserTask = Task.create({
      id: '33333333-3333-4333-8333-333333333333',
      accountId: otherAccountId,
      title: 'Other user task',
      date: '2026-10-15',
      category: 'school',
      now,
    });

    await taskRepo.save(task1);
    await taskRepo.save(taskOutside);
    await taskRepo.save(otherUserTask);

    const result = await useCase.execute({
      accountId,
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(task1.id);
    expect(result.deletedIds).toEqual([]);
    expect(result.serverTime).toBe(now.toISOString());
  });

  it('throws TaskValidationError if from or to format is invalid', async () => {
    await expect(
      useCase.execute({
        accountId,
        from: '2026/10/01',
        to: '2026-10-31',
      }),
    ).rejects.toThrow(TaskValidationError);

    await expect(
      useCase.execute({
        accountId,
        from: '2026-10-01',
        to: 'invalid',
      }),
    ).rejects.toThrow(TaskValidationError);
  });

  it('throws TaskValidationError if from is after to', async () => {
    await expect(
      useCase.execute({
        accountId,
        from: '2026-10-31',
        to: '2026-10-01',
      }),
    ).rejects.toThrow(TaskValidationError);
  });

  it('throws TaskValidationError if date range exceeds 42 days', async () => {
    await expect(
      useCase.execute({
        accountId,
        from: '2026-10-01',
        to: '2026-11-13', // 43 days diff
      }),
    ).rejects.toThrow(TaskValidationError);
  });

  it('allows date range exactly 42 days', async () => {
    const result = await useCase.execute({
      accountId,
      from: '2026-10-01',
      to: '2026-11-12', // 42 days diff
    });

    expect(result.items).toEqual([]);
  });

  it('throws SyncValidationError if updatedSince is older than 30 days', async () => {
    const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString();

    await expect(
      useCase.execute({
        accountId,
        from: '2026-10-01',
        to: '2026-10-31',
        updatedSince: thirtyOneDaysAgo,
      }),
    ).rejects.toThrow(SyncValidationError);
  });

  it('returns items modified since updatedSince and deletedIds of deleted tasks in date range', async () => {
    const t0 = new Date('2026-10-20T10:00:00.000Z');
    const tSync = '2026-10-25T00:00:00.000Z';
    const tUpdate = new Date('2026-10-26T08:00:00.000Z');

    const unmodifiedTask = Task.create({
      id: '11111111-1111-4111-8111-111111111111',
      accountId,
      title: 'Old task',
      date: '2026-10-15',
      category: 'school',
      now: t0,
    });

    const modifiedTask = Task.create({
      id: '22222222-2222-4222-8222-222222222222',
      accountId,
      title: 'Modified task',
      date: '2026-10-16',
      category: 'school',
      now: t0,
    });
    modifiedTask.update({ title: 'Updated title', now: tUpdate });

    const deletedTask = Task.create({
      id: '33333333-3333-4333-8333-333333333333',
      accountId,
      title: 'Deleted task',
      date: '2026-10-17',
      category: 'school',
      now: t0,
    });
    deletedTask.delete(tUpdate);

    await taskRepo.save(unmodifiedTask);
    await taskRepo.save(modifiedTask);
    await taskRepo.save(deletedTask);

    const result = await useCase.execute({
      accountId,
      from: '2026-10-01',
      to: '2026-10-31',
      updatedSince: tSync,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(modifiedTask.id);
    expect(result.deletedIds).toEqual([deletedTask.id]);
  });
});
