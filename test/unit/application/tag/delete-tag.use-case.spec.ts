import { DeleteTagUseCase } from '../../../../src/application/tag/delete-tag.use-case';
import { Tag } from '../../../../src/domain/tag/tag.entity';
import { Task } from '../../../../src/domain/task/task.entity';
import { Note } from '../../../../src/domain/note/note.entity';
import { EntityNotFoundError } from '../../../../src/domain/shared/sync.errors';
import { FixedClock } from '../../../fakes/fixed-clock';
import { FakeTagRepository } from './fake-tag.repository';
import { FakeTaskRepository } from '../task/fake-task.repository';
import { FakeNoteRepository } from '../note/fake-note.repository';
import { FakeUnitOfWork } from '../../../fakes/fake-unit-of-work';

describe('DeleteTagUseCase', () => {
  let tagRepo: FakeTagRepository;
  let taskRepo: FakeTaskRepository;
  let noteRepo: FakeNoteRepository;
  let uow: FakeUnitOfWork;
  let clock: FixedClock;
  let useCase: DeleteTagUseCase;

  const initialTime = new Date('2026-10-26T12:00:00.000Z');
  const deleteTime = new Date('2026-10-26T15:00:00.000Z');
  const accountId = 'acc-1';
  const tagId = '11111111-1111-4111-8111-111111111111';
  const tagId2 = '22222222-2222-4222-8222-222222222222';
  const taskId1 = '33333333-3333-4333-8333-333333333333';
  const taskId2 = '44444444-4444-4444-8444-444444444444';
  const noteId1 = '55555555-5555-4555-8555-555555555555';
  const noteId2 = '66666666-6666-4666-8666-666666666666';

  beforeEach(async () => {
    tagRepo = new FakeTagRepository();
    taskRepo = new FakeTaskRepository();
    noteRepo = new FakeNoteRepository();
    uow = new FakeUnitOfWork({ tagRepo, taskRepo, noteRepo });
    clock = new FixedClock(deleteTime);
    useCase = new DeleteTagUseCase(uow, clock);

    // Setup tags
    const tag1 = Tag.create({
      id: tagId,
      accountId,
      name: 'Toán 10',
      tone: 'pink',
      now: initialTime,
    });
    const tag2 = Tag.create({
      id: tagId2,
      accountId,
      name: 'Văn 10',
      tone: 'blue',
      now: initialTime,
    });
    await tagRepo.save(tag1);
    await tagRepo.save(tag2);

    // Setup tasks
    const task1 = Task.create({
      id: taskId1,
      accountId,
      title: 'Soạn đề kiểm tra Toán',
      date: '2026-10-26',
      category: 'school',
      tagIds: [tagId, tagId2],
      now: initialTime,
    });
    const task2 = Task.create({
      id: taskId2,
      accountId,
      title: 'Họp tổ bộ môn Văn',
      date: '2026-10-26',
      category: 'school',
      tagIds: [tagId2],
      now: initialTime,
    });
    await taskRepo.save(task1);
    await taskRepo.save(task2);

    // Setup notes
    const note1 = Note.create({
      id: noteId1,
      accountId,
      title: 'Ghi chú lớp 10A',
      content: 'Nhắc học sinh nộp bài tập Toán',
      checklist: [],
      tagIds: [tagId],
      now: initialTime,
    });
    const note2 = Note.create({
      id: noteId2,
      accountId,
      title: 'Kế hoạch tuần',
      content: 'Soạn giáo án Văn',
      checklist: [],
      tagIds: [tagId2],
      now: initialTime,
    });
    await noteRepo.save(note1);
    await noteRepo.save(note2);
  });

  it('soft deletes the tag and unlinks it from tasks and notes of the teacher, updating their updatedAt', async () => {
    await useCase.execute({
      id: tagId,
      accountId,
    });

    // 1. Tag is soft deleted
    const deletedTag = await tagRepo.findById(tagId);
    expect(deletedTag?.isDeleted()).toBe(true);
    expect(deletedTag?.deletedAt).toEqual(deleteTime);
    expect(deletedTag?.updatedAt).toEqual(deleteTime);

    // 2. Task 1 has tagId removed and updatedAt updated to deleteTime
    const updatedTask1 = await taskRepo.findById(taskId1);
    expect(updatedTask1?.tagIds).toEqual([tagId2]);
    expect(updatedTask1?.updatedAt).toEqual(deleteTime);

    // Task 2 did not have tagId, so its tagIds and updatedAt remain unchanged
    const unchangedTask2 = await taskRepo.findById(taskId2);
    expect(unchangedTask2?.tagIds).toEqual([tagId2]);
    expect(unchangedTask2?.updatedAt).toEqual(initialTime);

    // 3. Note 1 has tagId removed and updatedAt updated to deleteTime
    const updatedNote1 = await noteRepo.findById(noteId1);
    expect(updatedNote1?.tagIds).toEqual([]);
    expect(updatedNote1?.updatedAt).toEqual(deleteTime);

    // Note 2 did not have tagId, so its tagIds and updatedAt remain unchanged
    const unchangedNote2 = await noteRepo.findById(noteId2);
    expect(unchangedNote2?.tagIds).toEqual([tagId2]);
    expect(unchangedNote2?.updatedAt).toEqual(initialTime);
  });

  it('does not unlink or update tasks and notes of another teacher', async () => {
    const otherAccount = 'acc-2';
    const otherTaskId = '77777777-7777-4777-8777-777777777777';
    const otherNoteId = '88888888-8888-4888-8888-888888888888';

    const otherTask = Task.create({
      id: otherTaskId,
      accountId: otherAccount,
      title: 'Task thầy Tuấn',
      date: '2026-10-26',
      category: 'school',
      tagIds: [tagId],
      now: initialTime,
    });
    const otherNote = Note.create({
      id: otherNoteId,
      accountId: otherAccount,
      title: 'Note thầy Tuấn',
      content: 'Chi tiết',
      checklist: [],
      tagIds: [tagId],
      now: initialTime,
    });
    await taskRepo.save(otherTask);
    await noteRepo.save(otherNote);

    await useCase.execute({
      id: tagId,
      accountId,
    });

    const checkOtherTask = await taskRepo.findById(otherTaskId);
    expect(checkOtherTask?.tagIds).toEqual([tagId]);
    expect(checkOtherTask?.updatedAt).toEqual(initialTime);

    const checkOtherNote = await noteRepo.findById(otherNoteId);
    expect(checkOtherNote?.tagIds).toEqual([tagId]);
    expect(checkOtherNote?.updatedAt).toEqual(initialTime);
  });

  it('repeated delete call succeeds silently (idempotent 204) without modifying tasks/notes again', async () => {
    await useCase.execute({ id: tagId, accountId });

    // Advance clock
    clock.advance(1000 * 60);

    // Second call should return early without re-updating
    await expect(useCase.execute({ id: tagId, accountId })).resolves.toBeUndefined();

    const task1 = await taskRepo.findById(taskId1);
    expect(task1?.updatedAt).toEqual(deleteTime); // not advanced time
  });

  it('throws EntityNotFoundError (404) if tag does not exist', async () => {
    await expect(
      useCase.execute({
        id: '99999999-9999-4999-8999-999999999999',
        accountId,
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('throws EntityNotFoundError (404) if tag belongs to another account', async () => {
    await expect(
      useCase.execute({
        id: tagId,
        accountId: 'other-acc',
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('rolls back all changes when an error occurs during unlinking notes', async () => {
    jest.spyOn(noteRepo, 'unlinkTag').mockRejectedValueOnce(new Error('Simulated database error'));

    await expect(
      useCase.execute({
        id: tagId,
        accountId,
      }),
    ).rejects.toThrow('Simulated database error');

    // Verify rollback:
    // 1. Tag must NOT be soft deleted
    const tag = await tagRepo.findById(tagId);
    expect(tag?.isDeleted()).toBe(false);
    expect(tag?.deletedAt).toBeNull();
    expect(tag?.updatedAt).toEqual(initialTime);

    // 2. Task 1 must NOT have tagId unlinked and its updatedAt must not change
    const task1 = await taskRepo.findById(taskId1);
    expect(task1?.tagIds).toEqual([tagId, tagId2]);
    expect(task1?.updatedAt).toEqual(initialTime);

    // 3. Note 1 must NOT have tagId unlinked
    const note1 = await noteRepo.findById(noteId1);
    expect(note1?.tagIds).toEqual([tagId]);
    expect(note1?.updatedAt).toEqual(initialTime);
  });
});
