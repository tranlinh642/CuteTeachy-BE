import { CreateNoteUseCase } from '../../../../src/application/note/create-note.use-case';
import { FakeNoteRepository } from './fake-note.repository';
import { FixedClock } from '../../../fakes/fixed-clock';
import {
  EntityGoneError,
  IdConflictError,
} from '../../../../src/domain/shared/sync.errors';
import { NoteValidationError } from '../../../../src/domain/note/note.errors';
import { Note } from '../../../../src/domain/note/note.entity';

describe('CreateNoteUseCase', () => {
  let noteRepo: FakeNoteRepository;
  let clock: FixedClock;
  let useCase: CreateNoteUseCase;

  const validId = '11111111-1111-4111-8111-111111111111';
  const accountId = 'teacher-1';
  const now = new Date('2026-10-26T10:00:00.000Z');

  beforeEach(() => {
    noteRepo = new FakeNoteRepository();
    clock = new FixedClock(now);
    useCase = new CreateNoteUseCase(noteRepo, clock);
  });

  it('creates a new note successfully (201)', async () => {
    const result = await useCase.execute({
      id: validId,
      accountId,
      title: 'Giáo án tuần 9',
      content: 'Soạn bài tập hình học',
    });

    expect(result.created).toBe(true);
    expect(result.note.id).toBe(validId);
    expect(result.note.title).toBe('Giáo án tuần 9');
    expect(result.note.content).toBe('Soạn bài tập hình học');
    expect(result.note.completed).toBe(false);
  });

  it('is idempotent: returns existing note with created=false (200) when id belongs to same account', async () => {
    const existing = Note.create({
      id: validId,
      accountId,
      title: 'Đã tồn tại',
      now,
    });
    await noteRepo.save(existing);

    const result = await useCase.execute({
      id: validId,
      accountId,
      title: 'Cố tạo lại với tiêu đề khác',
    });

    expect(result.created).toBe(false);
    expect(result.note.title).toBe('Đã tồn tại');
  });

  it('throws IdConflictError (409) when note id belongs to a different account', async () => {
    const existing = Note.create({
      id: validId,
      accountId: 'another-teacher',
      title: 'Của giáo viên khác',
      now,
    });
    await noteRepo.save(existing);

    await expect(
      useCase.execute({
        id: validId,
        accountId,
        title: 'Thử chiếm id',
      }),
    ).rejects.toThrow(IdConflictError);
  });

  it('throws EntityGoneError (410) when note id was soft-deleted', async () => {
    const existing = Note.create({
      id: validId,
      accountId,
      title: 'Đã xoá',
      now,
    });
    existing.delete(now);
    await noteRepo.save(existing);

    await expect(
      useCase.execute({
        id: validId,
        accountId,
        title: 'Tạo lại id đã xoá',
      }),
    ).rejects.toThrow(EntityGoneError);
  });

  it('throws NoteValidationError (400) when tag does not belong to teacher', async () => {
    noteRepo.setValidTags(['valid-tag-1']);

    await expect(
      useCase.execute({
        id: validId,
        accountId,
        title: 'Note gắn tag lạ',
        tagIds: ['foreign-tag'],
      }),
    ).rejects.toThrow(NoteValidationError);
  });

  it('creates note with valid tags successfully', async () => {
    noteRepo.setValidTags(['tag-1', 'tag-2']);

    const result = await useCase.execute({
      id: validId,
      accountId,
      title: 'Note gắn tag hợp lệ',
      tagIds: ['tag-1', 'tag-2'],
    });

    expect(result.created).toBe(true);
    expect(result.note.tagIds).toEqual(['tag-1', 'tag-2']);
  });

  it('calculates completed automatically based on checklist', async () => {
    const result = await useCase.execute({
      id: validId,
      accountId,
      title: 'Checklist note',
      checklist: [
        { id: '22222222-2222-4222-8222-222222222222', text: 'Item 1', done: true },
        { id: '33333333-3333-4333-8333-333333333333', text: 'Item 2', done: true },
      ],
      completed: false, // client passed false
    });

    expect(result.created).toBe(true);
    expect(result.note.completed).toBe(true);
  });
});
