import { UpdateNoteUseCase } from '../../../../src/application/note/update-note.use-case';
import { FakeNoteRepository } from './fake-note.repository';
import { FixedClock } from '../../../fakes/fixed-clock';
import { EntityNotFoundError } from '../../../../src/domain/shared/sync.errors';
import { NoteValidationError } from '../../../../src/domain/note/note.errors';
import { Note } from '../../../../src/domain/note/note.entity';

describe('UpdateNoteUseCase', () => {
  let noteRepo: FakeNoteRepository;
  let clock: FixedClock;
  let useCase: UpdateNoteUseCase;

  const validId = '11111111-1111-4111-8111-111111111111';
  const accountId = 'teacher-1';
  const initialTime = new Date('2026-10-26T10:00:00.000Z');
  const updateTime = new Date('2026-10-26T12:00:00.000Z');

  beforeEach(async () => {
    noteRepo = new FakeNoteRepository();
    clock = new FixedClock(updateTime);
    useCase = new UpdateNoteUseCase(noteRepo, clock);

    const note = Note.create({
      id: validId,
      accountId,
      title: 'Tiêu đề ban đầu',
      content: 'Nội dung ban đầu',
      now: initialTime,
    });
    await noteRepo.save(note);
  });

  it('updates title and content successfully', async () => {
    const updated = await useCase.execute({
      id: validId,
      accountId,
      title: 'Tiêu đề mới',
      content: 'Nội dung mới',
    });

    expect(updated.title).toBe('Tiêu đề mới');
    expect(updated.content).toBe('Nội dung mới');
    expect(updated.updatedAt).toBe(updateTime.toISOString());
  });

  it('replaces checklist completely in PATCH and updates completed', async () => {
    const updated = await useCase.execute({
      id: validId,
      accountId,
      checklist: [
        { id: '22222222-2222-4222-8222-222222222222', text: 'Mục 1', done: true },
        { id: '33333333-3333-4333-8333-333333333333', text: 'Mục 2', done: true },
      ],
    });

    expect(updated.checklist).toHaveLength(2);
    expect(updated.completed).toBe(true);
  });

  it('throws EntityNotFoundError (404) if note does not exist', async () => {
    await expect(
      useCase.execute({
        id: '99999999-9999-4999-8999-999999999999',
        accountId,
        title: 'Mới',
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('throws EntityNotFoundError (404) if note belongs to another teacher', async () => {
    await expect(
      useCase.execute({
        id: validId,
        accountId: 'other-teacher',
        title: 'Mới',
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('throws EntityNotFoundError (404) if note is soft-deleted', async () => {
    const note = await noteRepo.findById(validId);
    note!.delete(initialTime);
    await noteRepo.save(note!);

    await expect(
      useCase.execute({
        id: validId,
        accountId,
        title: 'Cập nhật note đã xoá',
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('throws NoteValidationError (400) if new tag does not belong to teacher', async () => {
    noteRepo.setValidTags(['my-tag']);

    await expect(
      useCase.execute({
        id: validId,
        accountId,
        tagIds: ['alien-tag'],
      }),
    ).rejects.toThrow(NoteValidationError);
  });
});
