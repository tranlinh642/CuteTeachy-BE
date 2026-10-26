import { PurgeSoftDeletedTagsUseCase } from '../../../../src/application/tag/purge-soft-deleted-tags.use-case';
import { Tag } from '../../../../src/domain/tag/tag.entity';
import { FixedClock } from '../../../fakes/fixed-clock';
import { FakeTagRepository } from './fake-tag.repository';

describe('PurgeSoftDeletedTagsUseCase', () => {
  let tagRepo: FakeTagRepository;
  let clock: FixedClock;
  let useCase: PurgeSoftDeletedTagsUseCase;

  const now = new Date('2026-10-26T12:00:00.000Z');
  const accountId = 'acc-1';

  beforeEach(() => {
    tagRepo = new FakeTagRepository();
    clock = new FixedClock(now);
    useCase = new PurgeSoftDeletedTagsUseCase(tagRepo, clock);
  });

  it('purges soft-deleted tags deleted more than 30 days ago, keeping recent and active tags', async () => {
    // 1. Tag deleted 35 days ago (should be purged)
    const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
    const oldDeletedTag = Tag.create({
      id: '11111111-1111-4111-8111-111111111111',
      accountId,
      name: 'Rất cũ',
      tone: 'pink',
      now: thirtyFiveDaysAgo,
    });
    oldDeletedTag.delete(thirtyFiveDaysAgo);
    await tagRepo.save(oldDeletedTag);

    // 2. Tag deleted 10 days ago (should NOT be purged)
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const recentDeletedTag = Tag.create({
      id: '22222222-2222-4222-8222-222222222222',
      accountId,
      name: 'Vừa xoá',
      tone: 'blue',
      now: tenDaysAgo,
    });
    recentDeletedTag.delete(tenDaysAgo);
    await tagRepo.save(recentDeletedTag);

    // 3. Active tag created 40 days ago (should NOT be purged)
    const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
    const activeTag = Tag.create({
      id: '33333333-3333-4333-8333-333333333333',
      accountId,
      name: 'Đang hoạt động',
      tone: 'mint',
      now: fortyDaysAgo,
    });
    await tagRepo.save(activeTag);

    const result = await useCase.execute();

    expect(result.purgedCount).toBe(1);
    expect(await tagRepo.findById('11111111-1111-4111-8111-111111111111')).toBeNull();
    expect(await tagRepo.findById('22222222-2222-4222-8222-222222222222')).not.toBeNull();
    expect(await tagRepo.findById('33333333-3333-4333-8333-333333333333')).not.toBeNull();
  });
});
