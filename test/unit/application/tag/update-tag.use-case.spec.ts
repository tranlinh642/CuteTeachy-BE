import { UpdateTagUseCase } from '../../../../src/application/tag/update-tag.use-case';
import { Tag } from '../../../../src/domain/tag/tag.entity';
import { TagNameTakenError } from '../../../../src/domain/tag/tag.errors';
import { EntityNotFoundError } from '../../../../src/domain/shared/sync.errors';
import { FixedClock } from '../../../fakes/fixed-clock';
import { FakeTagRepository } from './fake-tag.repository';

describe('UpdateTagUseCase', () => {
  let tagRepo: FakeTagRepository;
  let clock: FixedClock;
  let useCase: UpdateTagUseCase;

  const now = new Date('2026-10-26T12:00:00.000Z');
  const later = new Date('2026-10-26T14:00:00.000Z');
  const accountId = 'acc-1';
  const tagId = '11111111-1111-4111-8111-111111111111';

  beforeEach(async () => {
    tagRepo = new FakeTagRepository();
    clock = new FixedClock(later);
    useCase = new UpdateTagUseCase(tagRepo, clock);

    const tag = Tag.create({
      id: tagId,
      accountId,
      name: 'Toán 10',
      tone: 'pink',
      now,
    });
    await tagRepo.save(tag);
  });

  it('updates tag name and tone successfully', async () => {
    const result = await useCase.execute({
      id: tagId,
      accountId,
      name: 'Toán 10 Nâng cao',
      tone: 'mint',
    });

    expect(result.id).toBe(tagId);
    expect(result.name).toBe('Toán 10 Nâng cao');
    expect(result.tone).toBe('mint');
    expect(result.updatedAt).toBe(later.toISOString());
  });

  it('throws EntityNotFoundError (404) if tag does not exist', async () => {
    await expect(
      useCase.execute({
        id: '22222222-2222-4222-8222-222222222222',
        accountId,
        name: 'Hoá 10',
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('throws EntityNotFoundError (404) if tag belongs to another account', async () => {
    await expect(
      useCase.execute({
        id: tagId,
        accountId: 'other-acc',
        name: 'Toán 10 Mới',
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('throws EntityNotFoundError (404) if tag is soft-deleted', async () => {
    const tag = await tagRepo.findById(tagId);
    tag!.delete(now);
    await tagRepo.save(tag!);

    await expect(
      useCase.execute({
        id: tagId,
        accountId,
        name: 'Toán 10 Hồi sinh',
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('throws TagNameTakenError (409) if updated name collides with another tag in same account', async () => {
    const secondTag = Tag.create({
      id: '22222222-2222-4222-8222-222222222222',
      accountId,
      name: 'Văn 12',
      tone: 'blue',
      now,
    });
    await tagRepo.save(secondTag);

    await expect(
      useCase.execute({
        id: tagId,
        accountId,
        name: '  văn 12  ',
      }),
    ).rejects.toThrow(TagNameTakenError);
  });

  it('allows keeping same name or changing casing of own name', async () => {
    const result = await useCase.execute({
      id: tagId,
      accountId,
      name: 'toán 10',
      tone: 'beige',
    });

    expect(result.name).toBe('toán 10');
    expect(result.tone).toBe('beige');
  });
});
