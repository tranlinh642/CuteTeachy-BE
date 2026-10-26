import { UpdateTaskUseCase } from '../../../../src/application/task/update-task.use-case';
import { Task } from '../../../../src/domain/task/task.entity';
import { Tag } from '../../../../src/domain/tag/tag.entity';
import { TaskValidationError } from '../../../../src/domain/task/task.errors';
import { EntityNotFoundError } from '../../../../src/domain/shared/sync.errors';
import { FixedClock } from '../../../fakes/fixed-clock';
import { FakeTaskRepository } from './fake-task.repository';
import { FakeTagRepository } from '../tag/fake-tag.repository';

describe('UpdateTaskUseCase', () => {
  let taskRepo: FakeTaskRepository;
  let tagRepo: FakeTagRepository;
  let clock: FixedClock;
  let useCase: UpdateTaskUseCase;

  const t0 = new Date('2026-10-26T10:00:00.000Z');
  const tUpdate = new Date('2026-10-26T12:00:00.000Z');
  const accountId = 'acc-1';
  const otherAccountId = 'acc-2';
  const taskId = '11111111-1111-4111-8111-111111111111';
  const tagId1 = '22222222-2222-4222-8222-222222222222';

  beforeEach(async () => {
    taskRepo = new FakeTaskRepository();
    tagRepo = new FakeTagRepository();
    clock = new FixedClock(tUpdate);
    useCase = new UpdateTaskUseCase(taskRepo, tagRepo, clock);

    const task = Task.create({
      id: taskId,
      accountId,
      title: 'Old Title',
      notes: 'Old Notes',
      date: '2026-10-27',
      time: '08:00',
      category: 'school',
      priority: 'normal',
      completed: false,
      now: t0,
    });
    await taskRepo.save(task);
  });

  it('updates task partially and refreshes updatedAt', async () => {
    await tagRepo.save(
      Tag.create({ id: tagId1, accountId, name: 'Tag 1', tone: 'mint', now: t0 }),
    );

    const updated = await useCase.execute({
      id: taskId,
      accountId,
      title: 'New Title',
      completed: true,
      priority: 'high',
      tagIds: [tagId1],
    });

    expect(updated.title).toBe('New Title');
    expect(updated.notes).toBe('Old Notes');
    expect(updated.completed).toBe(true);
    expect(updated.priority).toBe('high');
    expect(updated.tagIds).toEqual([tagId1]);
    expect(updated.updatedAt).toBe(tUpdate.toISOString());
  });

  it('throws EntityNotFoundError (404) if task not found', async () => {
    await expect(
      useCase.execute({
        id: '99999999-9999-4999-8999-999999999999',
        accountId,
        title: 'New',
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('throws EntityNotFoundError (404) if task belongs to another teacher', async () => {
    await expect(
      useCase.execute({
        id: taskId,
        accountId: otherAccountId,
        title: 'New',
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('throws EntityNotFoundError (404) if task is already deleted', async () => {
    const task = (await taskRepo.findById(taskId))!;
    task.delete(t0);
    await taskRepo.save(task);

    await expect(
      useCase.execute({
        id: taskId,
        accountId,
        title: 'New',
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('throws TaskValidationError (400) if updated tag does not belong to user', async () => {
    await tagRepo.save(
      Tag.create({ id: tagId1, accountId: otherAccountId, name: 'Tag 1', tone: 'mint', now: t0 }),
    );

    await expect(
      useCase.execute({
        id: taskId,
        accountId,
        tagIds: [tagId1],
      }),
    ).rejects.toThrow(TaskValidationError);
  });
});
