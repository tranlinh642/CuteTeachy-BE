import { FixedClock } from '../fakes/fixed-clock';
import { SequentialIdGenerator } from '../fakes/sequential-id-generator';

describe('Shared ports fakes', () => {
  it('FixedClock returns fixed timestamp', () => {
    const fixedDate = new Date('2026-10-24T00:00:00.000Z');
    const clock = new FixedClock(fixedDate);

    expect(clock.now()).toEqual(fixedDate);
  });

  it('SequentialIdGenerator generates sequential identifiers', () => {
    const ids = new SequentialIdGenerator('item');

    expect(ids.next()).toBe('item-1');
    expect(ids.next()).toBe('item-2');
    expect(ids.generate()).toBe('item-3');
  });
});
