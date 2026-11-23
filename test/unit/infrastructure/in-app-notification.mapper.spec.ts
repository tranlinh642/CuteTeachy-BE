import { InAppNotificationMapper } from '../../../src/infrastructure/persistence/prisma/mappers/in-app-notification.mapper';

describe('InAppNotificationMapper', () => {
  const createdAt = new Date('2026-10-29T08:00:00.000Z');
  const readAt = new Date('2026-10-29T08:05:00.000Z');

  it('maps between Prisma record and Domain entity', () => {
    const raw = {
      id: 'notif-1',
      accountId: 'acc-1',
      type: 'note',
      targetId: 'note-1',
      title: 'Nhắc nhở ghi chú: Nộp sổ điểm',
      body: '10:00',
      url: '/notes?noteId=note-1',
      data: { type: 'note', id: 'note-1', date: '2026-10-29', url: '/notes?noteId=note-1' },
      readAt,
      createdAt,
    };

    const entity = InAppNotificationMapper.toDomain(raw);
    expect(entity.id).toBe('notif-1');
    expect(entity.accountId).toBe('acc-1');
    expect(entity.type).toBe('note');
    expect(entity.targetId).toBe('note-1');
    expect(entity.title).toBe('Nhắc nhở ghi chú: Nộp sổ điểm');
    expect(entity.body).toBe('10:00');
    expect(entity.url).toBe('/notes?noteId=note-1');
    expect(entity.data).toEqual(raw.data);
    expect(entity.readAt).toEqual(readAt);
    expect(entity.createdAt).toEqual(createdAt);

    const prismaCreate = InAppNotificationMapper.toPrismaCreate(entity);
    expect(prismaCreate).toMatchObject({
      id: 'notif-1',
      accountId: 'acc-1',
      type: 'note',
      targetId: 'note-1',
      title: 'Nhắc nhở ghi chú: Nộp sổ điểm',
      body: '10:00',
      url: '/notes?noteId=note-1',
      readAt,
      createdAt,
    });
  });
});
