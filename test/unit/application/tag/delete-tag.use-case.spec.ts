import { DeleteTagUseCase } from '../../../../src/application/tag/delete-tag.use-case';
import { Tag } from '../../../../src/domain/tag/tag.entity';
import { EntityNotFoundError } from '../../../../src/domain/shared/sync.errors';
import { FixedClock } from '../../../fakes/fixed-clock';
import { FakeTagRepository } from './fake-tag.repository';

describe('DeleteTagUseCase', () => {
  let tagRepo: FakeTagRepository;
  let clock: FixedClock;
  let useCase: DeleteTagUseCase;

  const now = new Date('2026-10-26T12:00:00.000Z');
  const deleteTime = new Date('2026-10-26T15:00:00.000Z');
  const accountId = 'acc-1';
  const tagId = '11111111-1111-4111-8111-111111111111';

  beforeEach(async () => {
    tagRepo = new FakeTagRepository();
    clock = new FixedClock(deleteTime);
    useCase = new DeleteTagUseCase(tagRepo, clock);

    const tag = Tag.create({
      id: tagId,
      accountId,
      name: 'Toán 10',
      tone: 'pink',
      now,
    });
    await tagRepo.save(tag);
  });

  it('soft deletes the tag and sets deletedAt / updatedAt', async () => {
    await useCase.execute({
      id: tagId,
      accountId,
    });

    const deleted = await tagRepo.findById(tagId);
    expect(deleted?.isDeleted()).toBe(true);
    expect(deleted?.deletedAt).toEqual(deleteTime);
    expect(deleted?.updatedAt).toEqual(deleteTime);
  });

  it('repeated delete call succeeds silently (idempotent 204)', async () => {
    await useCase.execute({ id: tagId, accountId });
    await expect(useCase.execute({ id: tagId, accountId })).resolves.toBeUndefined();
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
});
