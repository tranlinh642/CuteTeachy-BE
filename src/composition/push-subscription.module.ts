import { Module } from '@nestjs/common';
import { NotificationModule } from './notification.module';
import { SettingsModule } from './settings.module';
import { CLOCK, Clock } from '../application/shared/ports/clock.port';
import { ID_GENERATOR, IdGenerator } from '../application/shared/ports/id-generator.port';
import {
  IN_APP_NOTIFICATION_REPOSITORY,
  InAppNotificationRepository,
} from '../application/notification/ports/in-app-notification.repository.port';
import {
  TEACHER_SETTINGS_READER,
  TeacherSettingsReader,
} from '../application/settings/ports/teacher-settings.port';
import {
  PUSH_SUBSCRIPTION_REPOSITORY,
  PushSubscriptionRepository,
} from '../application/push-subscription/ports/push-subscription.repository.port';
import { PUSH_SENDER, PushSender } from '../application/push-subscription/ports/push-sender.port';
import { GetVapidPublicKeyUseCase } from '../application/push-subscription/get-vapid-public-key.use-case';
import { UpsertPushSubscriptionUseCase } from '../application/push-subscription/upsert-push-subscription.use-case';
import { DeletePushSubscriptionUseCase } from '../application/push-subscription/delete-push-subscription.use-case';
import { SendPushToTeacherUseCase } from '../application/push-subscription/send-push-to-teacher.use-case';
import { SendTestNotificationUseCase } from '../application/push-subscription/send-test-notification.use-case';
import { PrismaPushSubscriptionRepository } from '../infrastructure/persistence/prisma/repositories/prisma-push-subscription.repository';
import { WebPushSender } from '../infrastructure/notification/web-push-sender';
import { PushSubscriptionController } from '../presentation/http/push-subscription/push-subscription.controller';

@Module({
  imports: [NotificationModule, SettingsModule],
  controllers: [PushSubscriptionController],
  providers: [
    {
      provide: PUSH_SUBSCRIPTION_REPOSITORY,
      useClass: PrismaPushSubscriptionRepository,
    },
    {
      provide: PUSH_SENDER,
      useClass: WebPushSender,
    },
    {
      provide: GetVapidPublicKeyUseCase,
      useFactory: (sender: PushSender) => new GetVapidPublicKeyUseCase(sender),
      inject: [PUSH_SENDER],
    },
    {
      provide: UpsertPushSubscriptionUseCase,
      useFactory: (repo: PushSubscriptionRepository, clock: Clock, idGen: IdGenerator) =>
        new UpsertPushSubscriptionUseCase(repo, clock, idGen),
      inject: [PUSH_SUBSCRIPTION_REPOSITORY, CLOCK, ID_GENERATOR],
    },
    {
      provide: DeletePushSubscriptionUseCase,
      useFactory: (repo: PushSubscriptionRepository) => new DeletePushSubscriptionUseCase(repo),
      inject: [PUSH_SUBSCRIPTION_REPOSITORY],
    },
    {
      provide: SendPushToTeacherUseCase,
      useFactory: (repo: PushSubscriptionRepository, sender: PushSender) =>
        new SendPushToTeacherUseCase(repo, sender),
      inject: [PUSH_SUBSCRIPTION_REPOSITORY, PUSH_SENDER],
    },
    {
      provide: SendTestNotificationUseCase,
      useFactory: (
        inAppRepo: InAppNotificationRepository,
        sendPushUseCase: SendPushToTeacherUseCase,
        settingsReader: TeacherSettingsReader,
        clock: Clock,
        idGen: IdGenerator,
      ) =>
        new SendTestNotificationUseCase(
          inAppRepo,
          sendPushUseCase,
          settingsReader,
          clock,
          idGen,
        ),
      inject: [
        IN_APP_NOTIFICATION_REPOSITORY,
        SendPushToTeacherUseCase,
        TEACHER_SETTINGS_READER,
        CLOCK,
        ID_GENERATOR,
      ],
    },
  ],
  exports: [
    PUSH_SUBSCRIPTION_REPOSITORY,
    PUSH_SENDER,
    GetVapidPublicKeyUseCase,
    UpsertPushSubscriptionUseCase,
    DeletePushSubscriptionUseCase,
    SendPushToTeacherUseCase,
    SendTestNotificationUseCase,
  ],
})
export class PushSubscriptionModule {}
