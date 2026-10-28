import { CreateTaskUseCase } from '../../../../src/application/task/create-task.use-case';
import { Task } from '../../../../src/domain/task/task.entity';
import { Tag } from '../../../../src/domain/tag/tag.entity';
import { TaskValidationError } from '../../../../src/domain/task/task.errors';
import { EntityGoneError, IdConflictError } from '../../../../src/domain/shared/sync.errors';
import { FixedClock } from '../../../fakes/fixed-clock';
import { FakeTaskRepository } from './fake-task.repository';
import { FakeTagRepository } from '../tag/fake-tag.repository';

describe('CreateTaskUseCase', () => {
  let taskRepo: FakeTaskRepository;
  let tagRepo: FakeTagRepository;
  let clock: FixedClock;
  let useCase: CreateTaskUseCase;

  const now = new Date('2026-10-26T12:00:00.000Z');
  const accountId = 'acc-1';
  const otherAccountId = 'acc-2';
  const taskId = '11111111-1111-4111-8111-111111111111';
  const tagId1 = '22222222-2222-4222-8222-222222222222';
  const tagId2 = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    taskRepo = new FakeTaskRepository();
    tagRepo = new FakeTagRepository();
    clock = new FixedClock(now);
    useCase = new CreateTaskUseCase(taskRepo, tagRepo, clock);
  });

  it('creates a new task successfully (201 Created)', async () => {
    await tagRepo.save(
      Tag.create({ id: tagId1, accountId, name: 'Tag 1', tone: 'mint', now }),
    );

    const result = await useCase.execute({
      id: taskId,
      accountId,
      title: 'Soạn đề kiểm tra',
      notes: 'Lớp 10A1',
      date: '2026-10-27',
      time: '09:00',
      category: 'school',
      priority: 'high',
      tagIds: [tagId1],
    });

    expect(result.created).toBe(true);
    expect(result.task.id).toBe(taskId);
    expect(result.task.title).toBe('Soạn đề kiểm tra');
    expect(result.task.notes).toBe('Lớp 10A1');
    expect(result.task.date).toBe('2026-10-27');
    expect(result.task.time).toBe('09:00');
    expect(result.task.category).toBe('school');
    expect(result.task.priority).toBe('high');
    expect(result.task.completed).toBe(false);
    expect(result.task.tagIds).toEqual([tagId1]);

    const saved = await taskRepo.findById(taskId);
    expect(saved).not.toBeNull();
  });

  it('returns existing task with created: false on duplicate call with same id and owner (200 OK)', async () => {
    await useCase.execute({
      id: taskId,
      accountId,
      title: 'Initial Title',
      date: '2026-10-27',
      category: 'personal',
    });

    const result = await useCase.execute({
      id: taskId,
      accountId,
      title: 'Different Title',
      date: '2026-10-28',
      category: 'school',
    });

    expect(result.created).toBe(false);
    expect(result.task.title).toBe('Initial Title');
  });

  it('throws IdConflictError (409) if id belongs to another teacher', async () => {
    const foreignTask = Task.create({
      id: taskId,
      accountId: otherAccountId,
      title: 'Other task',
      date: '2026-10-27',
      category: 'school',
      now,
    });
    await taskRepo.save(foreignTask);

    await expect(
      useCase.execute({
        id: taskId,
        accountId,
        title: 'My task',
        date: '2026-10-27',
        category: 'personal',
      }),
    ).rejects.toThrow(IdConflictError);
  });

  it('throws EntityGoneError (410) if id was already deleted', async () => {
    const existing = Task.create({
      id: taskId,
      accountId,
      title: 'Deleted task',
      date: '2026-10-27',
      category: 'school',
      now,
    });
    existing.delete(now);
    await taskRepo.save(existing);

    await expect(
      useCase.execute({
        id: taskId,
        accountId,
        title: 'New task with same id',
        date: '2026-10-27',
        category: 'school',
      }),
    ).rejects.toThrow(EntityGoneError);
  });

  it('throws TaskValidationError (400) if any tag does not belong to user or is deleted', async () => {
    await tagRepo.save(
      Tag.create({ id: tagId1, accountId, name: 'Tag 1', tone: 'mint', now }),
    );
    const deletedTag = Tag.create({
      id: tagId2,
      accountId,
      name: 'Tag 2',
      tone: 'mint',
      now,
    });
    deletedTag.delete(now);
    await tagRepo.save(deletedTag);

    await expect(
      useCase.execute({
        id: taskId,
        accountId,
        title: 'Task with deleted tag',
        date: '2026-10-27',
        category: 'school',
        tagIds: [tagId1, tagId2],
      }),
    ).rejects.toThrow(TaskValidationError);
  });

  it('throws TaskValidationError (400) if tag belongs to another account', async () => {
    await tagRepo.save(
      Tag.create({ id: tagId1, accountId: otherAccountId, name: 'Tag 1', tone: 'mint', now }),
    );

    await expect(
      useCase.execute({
        id: taskId,
        accountId,
        title: 'Task with other user tag',
        date: '2026-10-27',
        category: 'school',
        tagIds: [tagId1],
      }),
    ).rejects.toThrow(TaskValidationError);
  });
});
