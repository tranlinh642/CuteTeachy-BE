import { ListTagsUseCase } from '../../../../src/application/tag/list-tags.use-case';
import { Tag } from '../../../../src/domain/tag/tag.entity';
import { SyncValidationError } from '../../../../src/domain/shared/sync.errors';
import { FixedClock } from '../../../fakes/fixed-clock';
import { FakeTagRepository } from './fake-tag.repository';

describe('ListTagsUseCase', () => {
  let tagRepo: FakeTagRepository;
  let clock: FixedClock;
  let useCase: ListTagsUseCase;

  const now = new Date('2026-10-26T12:00:00.000Z');
  const accountId = 'acc-1';

  beforeEach(() => {
    tagRepo = new FakeTagRepository();
    clock = new FixedClock(now);
    useCase = new ListTagsUseCase(tagRepo, clock);
  });

  it('returns full active list and empty deletedIds when updatedSince is omitted', async () => {
    const tag1 = Tag.create({
      id: '11111111-1111-4111-8111-111111111111',
      accountId,
      name: 'Toán',
      tone: 'pink',
      now: new Date('2026-10-20T00:00:00.000Z'),
    });
    const tag2 = Tag.create({
      id: '22222222-2222-4222-8222-222222222222',
      accountId,
      name: 'Lý',
      tone: 'blue',
      now: new Date('2026-10-21T00:00:00.000Z'),
    });
    const deletedTag = Tag.create({
      id: '33333333-3333-4333-8333-333333333333',
      accountId,
      name: 'Hoá',
      tone: 'mint',
      now: new Date('2026-10-19T00:00:00.000Z'),
    });
    deletedTag.delete(new Date('2026-10-22T00:00:00.000Z'));

    await tagRepo.save(tag1);
    await tagRepo.save(tag2);
    await tagRepo.save(deletedTag);

    const result = await useCase.execute({ accountId });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.name)).toEqual(['Toán', 'Lý']);
    expect(result.deletedIds).toEqual([]);
    expect(result.serverTime).toBe(now.toISOString());
  });

  it('returns delta items and deletedIds when updatedSince is provided', async () => {
    const oldTag = Tag.create({
      id: '11111111-1111-4111-8111-111111111111',
      accountId,
      name: 'Cũ không đổi',
      tone: 'pink',
      now: new Date('2026-10-10T00:00:00.000Z'),
    });

    const updatedTag = Tag.create({
      id: '22222222-2222-4222-8222-222222222222',
      accountId,
      name: 'Mới cập nhật',
      tone: 'blue',
      now: new Date('2026-10-10T00:00:00.000Z'),
    });
    updatedTag.update({ name: 'Đã đổi tên', now: new Date('2026-10-22T00:00:00.000Z') });

    const deletedTag = Tag.create({
      id: '33333333-3333-4333-8333-333333333333',
      accountId,
      name: 'Bị xoá',
      tone: 'mint',
      now: new Date('2026-10-10T00:00:00.000Z'),
    });
    deletedTag.delete(new Date('2026-10-23T00:00:00.000Z'));

    await tagRepo.save(oldTag);
    await tagRepo.save(updatedTag);
    await tagRepo.save(deletedTag);

    const result = await useCase.execute({
      accountId,
      updatedSince: '2026-10-20T00:00:00.000Z',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('22222222-2222-4222-8222-222222222222');
    expect(result.deletedIds).toEqual(['33333333-3333-4333-8333-333333333333']);
  });

  it('throws SyncValidationError (400) if updatedSince is older than 30 days', async () => {
    const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);

    await expect(
      useCase.execute({
        accountId,
        updatedSince: thirtyOneDaysAgo.toISOString(),
      }),
    ).rejects.toThrow(SyncValidationError);
  });
});
