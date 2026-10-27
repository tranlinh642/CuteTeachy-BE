import { SentReminderMapper } from '../../../src/infrastructure/persistence/prisma/mappers/sent-reminder.mapper';

describe('SentReminderMapper', () => {
  const remindAt = new Date('2026-10-27T02:45:00.000Z');
  const sentAt = new Date('2026-10-27T02:45:01.000Z');

  it('maps between Prisma record and Domain entity', () => {
    const raw = {
      id: 'sent-1',
      type: 'task',
      targetId: 'task-100',
      remindAt,
      sentAt,
      accountId: 'acc-1',
    };

    const entity = SentReminderMapper.toDomain(raw);
    expect(entity.id).toBe('sent-1');
    expect(entity.type).toBe('task');
    expect(entity.targetId).toBe('task-100');
    expect(entity.remindAt).toEqual(remindAt);
    expect(entity.sentAt).toEqual(sentAt);
    expect(entity.accountId).toBe('acc-1');

    const prismaCreate = SentReminderMapper.toPrismaCreate(entity);
    expect(prismaCreate).toEqual(raw);
  });
});
