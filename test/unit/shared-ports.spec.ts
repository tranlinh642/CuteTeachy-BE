import { FixedClock } from '../fakes/fixed-clock';
import { SequentialIdGenerator } from '../fakes/sequential-id-generator';
import { FakeMailer } from '../fakes/fake-mailer';

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

  it('FakeMailer records sent emails in memory', async () => {
    const mailer = new FakeMailer();
    await mailer.sendEmail('test@cuteteachy.local', 'Subject', '<p>Hello</p>', 'Hello');

    expect(mailer.sentEmails).toHaveLength(1);
    expect(mailer.sentEmails[0]).toEqual({
      to: 'test@cuteteachy.local',
      subject: 'Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    mailer.clear();
    expect(mailer.sentEmails).toHaveLength(0);
  });
});
