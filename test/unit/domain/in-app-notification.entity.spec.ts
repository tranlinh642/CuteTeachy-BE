import { InAppNotification } from '../../../src/domain/notification/in-app-notification.entity';
import {
  IN_APP_NOTIFICATION_TYPES,
  isInAppNotificationType,
} from '../../../src/domain/notification/in-app-notification-type.vo';
import {
  NotificationNotFoundError,
  NotificationValidationError,
} from '../../../src/domain/notification/notification.errors';

describe('InAppNotification Entity & VO', () => {
  const fixedNow = new Date('2026-10-29T08:00:00.000Z');

  describe('InAppNotificationType VO', () => {
    it('supports task, class_session, note, and system types', () => {
      expect(IN_APP_NOTIFICATION_TYPES).toEqual(['task', 'class_session', 'note', 'system']);
      expect(isInAppNotificationType('task')).toBe(true);
      expect(isInAppNotificationType('class_session')).toBe(true);
      expect(isInAppNotificationType('note')).toBe(true);
      expect(isInAppNotificationType('system')).toBe(true);
      expect(isInAppNotificationType('invalid')).toBe(false);
      expect(isInAppNotificationType(null)).toBe(false);
    });
  });

  describe('NotificationNotFoundError', () => {
    it('has code not_found', () => {
      const err = new NotificationNotFoundError('Notification not found');
      expect(err.code).toBe('not_found');
      expect(err.message).toBe('Notification not found');
    });
  });

  describe('InAppNotification.create', () => {
    it('creates an unread notification with valid properties', () => {
      const notification = InAppNotification.create({
        id: 'notif-1',
        accountId: 'acc-1',
        type: 'note',
        targetId: 'note-1',
        title: 'Nhắc nhở ghi chú: Nộp sổ điểm',
        body: '10:00',
        url: '/notes?noteId=note-1',
        data: { type: 'note', id: 'note-1', date: '2026-10-29', url: '/notes?noteId=note-1' },
        now: fixedNow,
      });

      expect(notification.id).toBe('notif-1');
      expect(notification.accountId).toBe('acc-1');
      expect(notification.type).toBe('note');
      expect(notification.targetId).toBe('note-1');
      expect(notification.title).toBe('Nhắc nhở ghi chú: Nộp sổ điểm');
      expect(notification.body).toBe('10:00');
      expect(notification.url).toBe('/notes?noteId=note-1');
      expect(notification.data).toEqual({
        type: 'note',
        id: 'note-1',
        date: '2026-10-29',
        url: '/notes?noteId=note-1',
      });
      expect(notification.readAt).toBeNull();
      expect(notification.createdAt).toEqual(fixedNow);
    });

    it('defaults targetId and data to null when omitted for system notification', () => {
      const notification = InAppNotification.create({
        id: 'notif-sys-1',
        accountId: 'acc-1',
        type: 'system',
        title: 'Thông báo thử nghiệm',
        body: 'Hệ thống thông báo hoạt động tốt!',
        url: '/settings',
        now: fixedNow,
      });

      expect(notification.targetId).toBeNull();
      expect(notification.data).toBeNull();
      expect(notification.readAt).toBeNull();
    });

    it('throws NotificationValidationError when required fields are invalid', () => {
      expect(() =>
        InAppNotification.create({
          id: '',
          accountId: 'acc-1',
          type: 'task',
          title: 'Title',
          body: 'Body',
          url: '/tasks',
          now: fixedNow,
        }),
      ).toThrow(NotificationValidationError);

      expect(() =>
        InAppNotification.create({
          id: 'notif-1',
          accountId: '',
          type: 'task',
          title: 'Title',
          body: 'Body',
          url: '/tasks',
          now: fixedNow,
        }),
      ).toThrow(NotificationValidationError);

      expect(() =>
        InAppNotification.create({
          id: 'notif-1',
          accountId: 'acc-1',
          type: 'invalid' as any,
          title: 'Title',
          body: 'Body',
          url: '/tasks',
          now: fixedNow,
        }),
      ).toThrow(NotificationValidationError);

      expect(() =>
        InAppNotification.create({
          id: 'notif-1',
          accountId: 'acc-1',
          type: 'task',
          title: '',
          body: 'Body',
          url: '/tasks',
          now: fixedNow,
        }),
      ).toThrow(NotificationValidationError);

      expect(() =>
        InAppNotification.create({
          id: 'notif-1',
          accountId: 'acc-1',
          type: 'task',
          title: 'Title',
          body: '',
          url: '/tasks',
          now: fixedNow,
        }),
      ).toThrow(NotificationValidationError);

      expect(() =>
        InAppNotification.create({
          id: 'notif-1',
          accountId: 'acc-1',
          type: 'task',
          title: 'Title',
          body: 'Body',
          url: '',
          now: fixedNow,
        }),
      ).toThrow(NotificationValidationError);
    });
  });

  describe('markRead', () => {
    it('sets readAt when unread and preserves initial readAt on subsequent calls', () => {
      const notification = InAppNotification.create({
        id: 'notif-1',
        accountId: 'acc-1',
        type: 'task',
        targetId: 'task-1',
        title: 'Task title',
        body: '10:00',
        url: '/tasks?date=2026-10-29',
        now: fixedNow,
      });

      const readTime = new Date('2026-10-29T08:05:00.000Z');
      notification.markRead(readTime);
      expect(notification.readAt).toEqual(readTime);

      const laterTime = new Date('2026-10-29T09:00:00.000Z');
      notification.markRead(laterTime);
      expect(notification.readAt).toEqual(readTime);
    });
  });
});
