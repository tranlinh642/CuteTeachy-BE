import { Module } from '@nestjs/common';
import { CLOCK, Clock } from '../application/shared/ports/clock.port';
import {
  IN_APP_NOTIFICATION_REPOSITORY,
  InAppNotificationRepository,
} from '../application/notification/ports/in-app-notification.repository.port';
import { ListInAppNotificationsUseCase } from '../application/notification/list-in-app-notifications.use-case';
import { MarkInAppNotificationReadUseCase } from '../application/notification/mark-in-app-notification-read.use-case';
import { MarkAllInAppNotificationsReadUseCase } from '../application/notification/mark-all-in-app-notifications-read.use-case';
import { PrismaInAppNotificationRepository } from '../infrastructure/persistence/prisma/repositories/prisma-in-app-notification.repository';
import { NotificationController } from '../presentation/http/notification/notification.controller';

@Module({
  controllers: [NotificationController],
  providers: [
    {
      provide: IN_APP_NOTIFICATION_REPOSITORY,
      useClass: PrismaInAppNotificationRepository,
    },
    {
      provide: ListInAppNotificationsUseCase,
      useFactory: (repo: InAppNotificationRepository) =>
        new ListInAppNotificationsUseCase(repo),
      inject: [IN_APP_NOTIFICATION_REPOSITORY],
    },
    {
      provide: MarkInAppNotificationReadUseCase,
      useFactory: (repo: InAppNotificationRepository, clock: Clock) =>
        new MarkInAppNotificationReadUseCase(repo, clock),
      inject: [IN_APP_NOTIFICATION_REPOSITORY, CLOCK],
    },
    {
      provide: MarkAllInAppNotificationsReadUseCase,
      useFactory: (repo: InAppNotificationRepository, clock: Clock) =>
        new MarkAllInAppNotificationsReadUseCase(repo, clock),
      inject: [IN_APP_NOTIFICATION_REPOSITORY, CLOCK],
    },
  ],
  exports: [
    IN_APP_NOTIFICATION_REPOSITORY,
    ListInAppNotificationsUseCase,
    MarkInAppNotificationReadUseCase,
    MarkAllInAppNotificationsReadUseCase,
  ],
})
export class NotificationModule {}
