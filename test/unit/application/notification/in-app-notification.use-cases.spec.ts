import { ListInAppNotificationsUseCase } from '../../../../src/application/notification/list-in-app-notifications.use-case';
import { MarkInAppNotificationReadUseCase } from '../../../../src/application/notification/mark-in-app-notification-read.use-case';
import { MarkAllInAppNotificationsReadUseCase } from '../../../../src/application/notification/mark-all-in-app-notifications-read.use-case';
import { InMemoryInAppNotificationRepository } from '../../../fakes/in-memory-in-app-notification.repository';
import { FixedClock } from '../../../fakes/fixed-clock';
import { InAppNotification } from '../../../../src/domain/notification/in-app-notification.entity';
import { NotificationNotFoundError } from '../../../../src/domain/notification/notification.errors';

describe('InAppNotification Use Cases', () => {
  let repo: InMemoryInAppNotificationRepository;
  let clock: FixedClock;
  let listUseCase: ListInAppNotificationsUseCase;
  let markReadUseCase: MarkInAppNotificationReadUseCase;
  let markAllReadUseCase: MarkAllInAppNotificationsReadUseCase;

  const teacher1 = 'teacher-1';
  const teacher2 = 'teacher-2';
  const baseTime = new Date('2026-10-29T08:00:00.000Z');

  beforeEach(() => {
    repo = new InMemoryInAppNotificationRepository();
    clock = new FixedClock(baseTime);
    listUseCase = new ListInAppNotificationsUseCase(repo);
    markReadUseCase = new MarkInAppNotificationReadUseCase(repo, clock);
    markAllReadUseCase = new MarkAllInAppNotificationsReadUseCase(repo, clock);
  });

  describe('ListInAppNotificationsUseCase', () => {
    it('returns items ordered by createdAt desc and unreadCount for the given account', async () => {
      const n1 = InAppNotification.create({
        id: 'notif-1',
        accountId: teacher1,
        type: 'task',
        targetId: 't-1',
        title: 'Task 1',
        body: '08:00',
        url: '/tasks?date=2026-10-29',
        now: new Date('2026-10-29T07:00:00.000Z'),
      });
      const n2 = InAppNotification.create({
        id: 'notif-2',
        accountId: teacher1,
        type: 'note',
        targetId: 'note-1',
        title: 'Note 1',
        body: '09:00',
        url: '/notes?noteId=note-1',
        now: new Date('2026-10-29T07:30:00.000Z'),
      });
      n1.markRead(new Date('2026-10-29T07:10:00.000Z'));

      const otherTeacherNotif = InAppNotification.create({
        id: 'notif-3',
        accountId: teacher2,
        type: 'system',
        title: 'Other teacher',
        body: 'Body',
        url: '/',
        now: new Date('2026-10-29T07:45:00.000Z'),
      });

      await repo.save(n1);
      await repo.save(n2);
      await repo.save(otherTeacherNotif);

      const res = await listUseCase.execute({ accountId: teacher1 });

      expect(res.unreadCount).toBe(1);
      expect(res.items).toHaveLength(2);
      expect(res.items[0].id).toBe('notif-2');
      expect(res.items[0].readAt).toBeNull();
      expect(res.items[1].id).toBe('notif-1');
      expect(res.items[1].readAt).toBe('2026-10-29T07:10:00.000Z');
    });

    it('filters by unreadOnly=true and respects limit', async () => {
      for (let i = 1; i <= 5; i++) {
        const n = InAppNotification.create({
          id: `notif-${i}`,
          accountId: teacher1,
          type: 'task',
          targetId: `t-${i}`,
          title: `Task ${i}`,
          body: '10:00',
          url: '/tasks',
          now: new Date(baseTime.getTime() + i * 1000),
        });
        if (i <= 2) {
          n.markRead(baseTime);
        }
        await repo.save(n);
      }

      const unreadRes = await listUseCase.execute({
        accountId: teacher1,
        unreadOnly: true,
        limit: 2,
      });

      expect(unreadRes.unreadCount).toBe(3);
      expect(unreadRes.items).toHaveLength(2);
      expect(unreadRes.items.map((x) => x.id)).toEqual(['notif-5', 'notif-4']);
    });
  });

  describe('MarkInAppNotificationReadUseCase', () => {
    it('marks an unread notification as read and returns DTO', async () => {
      const n = InAppNotification.create({
        id: 'notif-1',
        accountId: teacher1,
        type: 'class_session',
        targetId: 'cs-1',
        title: 'Tiết dạy: Toán 10A',
        body: 'Bắt đầu lúc 08:00',
        url: '/timetable?date=2026-10-29',
        now: new Date('2026-10-29T07:45:00.000Z'),
      });
      await repo.save(n);

      const dto = await markReadUseCase.execute({
        id: 'notif-1',
        accountId: teacher1,
      });

      expect(dto.id).toBe('notif-1');
      expect(dto.readAt).toBe(baseTime.toISOString());

      const inRepo = await repo.findById('notif-1');
      expect(inRepo?.readAt).toEqual(baseTime);
    });

    it('throws NotificationNotFoundError when notification does not exist or belongs to another account', async () => {
      const n = InAppNotification.create({
        id: 'notif-other',
        accountId: teacher2,
        type: 'task',
        targetId: 't-other',
        title: 'Private task',
        body: '10:00',
        url: '/tasks',
        now: baseTime,
      });
      await repo.save(n);

      await expect(
        markReadUseCase.execute({ id: 'non-existent', accountId: teacher1 }),
      ).rejects.toThrow(NotificationNotFoundError);

      await expect(
        markReadUseCase.execute({ id: 'notif-other', accountId: teacher1 }),
      ).rejects.toThrow(NotificationNotFoundError);
    });
  });

  describe('MarkAllInAppNotificationsReadUseCase', () => {
    it('marks all unread notifications of the teacher as read and returns updatedCount', async () => {
      const n1 = InAppNotification.create({
        id: 'notif-1',
        accountId: teacher1,
        type: 'task',
        title: 'T1',
        body: '08:00',
        url: '/tasks',
        now: baseTime,
      });
      const n2 = InAppNotification.create({
        id: 'notif-2',
        accountId: teacher1,
        type: 'note',
        title: 'N1',
        body: '09:00',
        url: '/notes',
        now: baseTime,
      });
      const n3AlreadyRead = InAppNotification.create({
        id: 'notif-3',
        accountId: teacher1,
        type: 'system',
        title: 'S1',
        body: 'Body',
        url: '/',
        now: baseTime,
      });
      n3AlreadyRead.markRead(new Date('2026-10-29T07:50:00.000Z'));

      const otherTeacherUnread = InAppNotification.create({
        id: 'notif-4',
        accountId: teacher2,
        type: 'task',
        title: 'T2',
        body: '10:00',
        url: '/tasks',
        now: baseTime,
      });

      await repo.save(n1);
      await repo.save(n2);
      await repo.save(n3AlreadyRead);
      await repo.save(otherTeacherUnread);

      const res = await markAllReadUseCase.execute({ accountId: teacher1 });

      expect(res).toEqual({ updatedCount: 2 });
      expect(await repo.countUnreadByAccountId(teacher1)).toBe(0);
      expect(await repo.countUnreadByAccountId(teacher2)).toBe(1);
    });
  });
});
