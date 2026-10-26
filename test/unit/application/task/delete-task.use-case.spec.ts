import { DeleteTaskUseCase } from '../../../../src/application/task/delete-task.use-case';
import { Task } from '../../../../src/domain/task/task.entity';
import { EntityNotFoundError } from '../../../../src/domain/shared/sync.errors';
import { FixedClock } from '../../../fakes/fixed-clock';
import { FakeTaskRepository } from './fake-task.repository';

describe('DeleteTaskUseCase', () => {
  let taskRepo: FakeTaskRepository;
  let clock: FixedClock;
  let useCase: DeleteTaskUseCase;

  const t0 = new Date('2026-10-26T10:00:00.000Z');
  const tDelete = new Date('2026-10-26T12:00:00.000Z');
  const accountId = 'acc-1';
  const otherAccountId = 'acc-2';
  const taskId = '11111111-1111-4111-8111-111111111111';

  beforeEach(async () => {
    taskRepo = new FakeTaskRepository();
    clock = new FixedClock(tDelete);
    useCase = new DeleteTaskUseCase(taskRepo, clock);

    const task = Task.create({
      id: taskId,
      accountId,
      title: 'Task to delete',
      date: '2026-10-27',
      category: 'school',
      now: t0,
    });
    await taskRepo.save(task);
  });

  it('soft deletes an existing task', async () => {
    await useCase.execute({
      id: taskId,
      accountId,
    });

    const deleted = await taskRepo.findById(taskId);
    expect(deleted?.isDeleted()).toBe(true);
    expect(deleted?.deletedAt).toEqual(tDelete);
    expect(deleted?.updatedAt).toEqual(tDelete);
  });

  it('is idempotent when task is already deleted', async () => {
    await useCase.execute({
      id: taskId,
      accountId,
    });

    // Second call should not throw and should keep the original delete timestamp
    await expect(
      useCase.execute({
        id: taskId,
        accountId,
      }),
    ).resolves.toBeUndefined();

    const deleted = await taskRepo.findById(taskId);
    expect(deleted?.deletedAt).toEqual(tDelete);
  });

  it('throws EntityNotFoundError (404) if task not found', async () => {
    await expect(
      useCase.execute({
        id: '99999999-9999-4999-8999-999999999999',
        accountId,
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('throws EntityNotFoundError (404) if task belongs to another teacher', async () => {
    await expect(
      useCase.execute({
        id: taskId,
        accountId: otherAccountId,
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });
});
