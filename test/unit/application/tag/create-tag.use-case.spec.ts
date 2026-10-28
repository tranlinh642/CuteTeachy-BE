import { CreateTagUseCase } from '../../../../src/application/tag/create-tag.use-case';
import { Tag } from '../../../../src/domain/tag/tag.entity';
import { TagNameTakenError } from '../../../../src/domain/tag/tag.errors';
import { EntityGoneError, IdConflictError } from '../../../../src/domain/shared/sync.errors';
import { FixedClock } from '../../../fakes/fixed-clock';
import { FakeTagRepository } from './fake-tag.repository';

describe('CreateTagUseCase', () => {
  let tagRepo: FakeTagRepository;
  let clock: FixedClock;
  let useCase: CreateTagUseCase;

  const now = new Date('2026-10-26T12:00:00.000Z');
  const accountId = 'acc-1';
  const tagId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    tagRepo = new FakeTagRepository();
    clock = new FixedClock(now);
    useCase = new CreateTagUseCase(tagRepo, clock);
  });

  it('creates a new tag successfully with 201 created output', async () => {
    const result = await useCase.execute({
      id: tagId,
      accountId,
      name: 'Toán 10',
      tone: 'pink',
    });

    expect(result.created).toBe(true);
    expect(result.tag.id).toBe(tagId);
    expect(result.tag.name).toBe('Toán 10');
    expect(result.tag.tone).toBe('pink');

    const saved = await tagRepo.findById(tagId);
    expect(saved).not.toBeNull();
    expect(saved?.name).toBe('Toán 10');
  });

  it('returns existing tag with created: false when repeated with same id by same account (idempotent 200)', async () => {
    await useCase.execute({
      id: tagId,
      accountId,
      name: 'Toán 10',
      tone: 'pink',
    });

    const result = await useCase.execute({
      id: tagId,
      accountId,
      name: 'Toán 10 (Different name ignored)',
      tone: 'blue',
    });

    expect(result.created).toBe(false);
    expect(result.tag.id).toBe(tagId);
    expect(result.tag.name).toBe('Toán 10'); // unchanged
  });

  it('throws IdConflictError (409) if id belongs to another account', async () => {
    await useCase.execute({
      id: tagId,
      accountId: 'other-acc',
      name: 'Lý 11',
      tone: 'blue',
    });

    await expect(
      useCase.execute({
        id: tagId,
        accountId,
        name: 'Hoá 12',
        tone: 'mint',
      }),
    ).rejects.toThrow(IdConflictError);
  });

  it('throws EntityGoneError (410) if id was soft-deleted', async () => {
    const tag = Tag.create({
      id: tagId,
      accountId,
      name: 'Toán 10',
      tone: 'pink',
      now,
    });
    tag.delete(now);
    await tagRepo.save(tag);

    await expect(
      useCase.execute({
        id: tagId,
        accountId,
        name: 'Toán 10',
        tone: 'pink',
      }),
    ).rejects.toThrow(EntityGoneError);
  });

  it('throws TagNameTakenError (409) if tag with same name (case-insensitive) exists for same account', async () => {
    await useCase.execute({
      id: tagId,
      accountId,
      name: 'Toán 10',
      tone: 'pink',
    });

    const anotherId = '22222222-2222-4222-8222-222222222222';
    await expect(
      useCase.execute({
        id: anotherId,
        accountId,
        name: '  toán 10  ',
        tone: 'blue',
      }),
    ).rejects.toThrow(TagNameTakenError);
  });

  it('allows same name if previously deleted tag had that name', async () => {
    const oldTag = Tag.create({
      id: tagId,
      accountId,
      name: 'Toán 10',
      tone: 'pink',
      now,
    });
    oldTag.delete(now);
    await tagRepo.save(oldTag);

    const newId = '22222222-2222-4222-8222-222222222222';
    const result = await useCase.execute({
      id: newId,
      accountId,
      name: 'toán 10',
      tone: 'blue',
    });

    expect(result.created).toBe(true);
    expect(result.tag.id).toBe(newId);
  });

  it('allows same name across different accounts', async () => {
    await useCase.execute({
      id: tagId,
      accountId: 'acc-1',
      name: 'Toán 10',
      tone: 'pink',
    });

    const otherId = '22222222-2222-4222-8222-222222222222';
    const result = await useCase.execute({
      id: otherId,
      accountId: 'acc-2',
      name: 'toán 10',
      tone: 'mint',
    });

    expect(result.created).toBe(true);
  });
});
