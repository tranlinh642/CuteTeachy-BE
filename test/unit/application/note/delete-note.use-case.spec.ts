import { DeleteNoteUseCase } from '../../../../src/application/note/delete-note.use-case';
import { FakeNoteRepository } from './fake-note.repository';
import { FixedClock } from '../../../fakes/fixed-clock';
import { EntityNotFoundError } from '../../../../src/domain/shared/sync.errors';
import { Note } from '../../../../src/domain/note/note.entity';

describe('DeleteNoteUseCase', () => {
  let noteRepo: FakeNoteRepository;
  let clock: FixedClock;
  let useCase: DeleteNoteUseCase;

  const validId = '11111111-1111-4111-8111-111111111111';
  const accountId = 'teacher-1';
  const initialTime = new Date('2026-10-26T10:00:00.000Z');
  const deleteTime = new Date('2026-10-26T12:00:00.000Z');

  beforeEach(async () => {
    noteRepo = new FakeNoteRepository();
    clock = new FixedClock(deleteTime);
    useCase = new DeleteNoteUseCase(noteRepo, clock);

    const note = Note.create({
      id: validId,
      accountId,
      title: 'Note sắp bị xoá',
      now: initialTime,
    });
    await noteRepo.save(note);
  });

  it('soft-deletes an active note', async () => {
    await useCase.execute({ id: validId, accountId });

    const note = await noteRepo.findById(validId);
    expect(note!.isDeleted()).toBe(true);
    expect(note!.deletedAt).toEqual(deleteTime);
  });

  it('is idempotent when note is already soft-deleted', async () => {
    await useCase.execute({ id: validId, accountId });
    // Calling delete a second time should not throw
    await expect(useCase.execute({ id: validId, accountId })).resolves.toBeUndefined();
  });

  it('throws EntityNotFoundError (404) when note does not exist', async () => {
    await expect(
      useCase.execute({ id: '99999999-9999-4999-8999-999999999999', accountId }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('throws EntityNotFoundError (404) when note belongs to another teacher', async () => {
    await expect(
      useCase.execute({ id: validId, accountId: 'other-teacher' }),
    ).rejects.toThrow(EntityNotFoundError);
  });
});
