import { NotificationController } from '../../../src/presentation/http/notification/notification.controller';
import { ListInAppNotificationsUseCase } from '../../../src/application/notification/list-in-app-notifications.use-case';
import { MarkInAppNotificationReadUseCase } from '../../../src/application/notification/mark-in-app-notification-read.use-case';
import { MarkAllInAppNotificationsReadUseCase } from '../../../src/application/notification/mark-all-in-app-notifications-read.use-case';
import { AccessTokenPayload } from '../../../src/application/account/ports/token.service.port';

describe('NotificationController', () => {
  let controller: NotificationController;
  let listUseCase: jest.Mocked<ListInAppNotificationsUseCase>;
  let markReadUseCase: jest.Mocked<MarkInAppNotificationReadUseCase>;
  let markAllReadUseCase: jest.Mocked<MarkAllInAppNotificationsReadUseCase>;

  const mockUser: AccessTokenPayload = {
    sub: 'teacher-1',
  };

  beforeEach(() => {
    listUseCase = { execute: jest.fn() } as any;
    markReadUseCase = { execute: jest.fn() } as any;
    markAllReadUseCase = { execute: jest.fn() } as any;

    controller = new NotificationController(
      listUseCase,
      markReadUseCase,
      markAllReadUseCase,
    );
  });

  describe('GET /notifications', () => {
    it('delegates to ListInAppNotificationsUseCase with query options', async () => {
      listUseCase.execute.mockResolvedValueOnce({
        items: [],
        unreadCount: 0,
      });

      const result = await controller.list(mockUser, { unreadOnly: true, limit: 20 });

      expect(result).toEqual({ items: [], unreadCount: 0 });
      expect(listUseCase.execute).toHaveBeenCalledWith({
        accountId: 'teacher-1',
        unreadOnly: true,
        limit: 20,
      });
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    it('delegates to MarkInAppNotificationReadUseCase', async () => {
      const mockDto = {
        id: 'notif-1',
        accountId: 'teacher-1',
        type: 'task' as const,
        targetId: 't-1',
        title: 'Task',
        body: '10:00',
        url: '/tasks',
        data: null,
        readAt: '2026-10-29T08:00:00.000Z',
        createdAt: '2026-10-29T07:50:00.000Z',
      };
      markReadUseCase.execute.mockResolvedValueOnce(mockDto);

      const result = await controller.markRead(mockUser, 'notif-1');

      expect(result).toEqual(mockDto);
      expect(markReadUseCase.execute).toHaveBeenCalledWith({
        id: 'notif-1',
        accountId: 'teacher-1',
      });
    });
  });

  describe('POST /notifications/read-all', () => {
    it('delegates to MarkAllInAppNotificationsReadUseCase', async () => {
      markAllReadUseCase.execute.mockResolvedValueOnce({ updatedCount: 4 });

      const result = await controller.markAllRead(mockUser);

      expect(result).toEqual({ updatedCount: 4 });
      expect(markAllReadUseCase.execute).toHaveBeenCalledWith({
        accountId: 'teacher-1',
      });
    });
  });
});
