import { Module } from '@nestjs/common';
import { CLOCK, Clock } from '../application/shared/ports/clock.port';
import { ID_GENERATOR, IdGenerator } from '../application/shared/ports/id-generator.port';
import {
  PUSH_SUBSCRIPTION_REPOSITORY,
  PushSubscriptionRepository,
} from '../application/push-subscription/ports/push-subscription.repository.port';
import { PUSH_SENDER, PushSender } from '../application/push-subscription/ports/push-sender.port';
import { GetVapidPublicKeyUseCase } from '../application/push-subscription/get-vapid-public-key.use-case';
import { UpsertPushSubscriptionUseCase } from '../application/push-subscription/upsert-push-subscription.use-case';
import { DeletePushSubscriptionUseCase } from '../application/push-subscription/delete-push-subscription.use-case';
import { SendPushToTeacherUseCase } from '../application/push-subscription/send-push-to-teacher.use-case';
import { PrismaPushSubscriptionRepository } from '../infrastructure/persistence/prisma/repositories/prisma-push-subscription.repository';
import { WebPushSender } from '../infrastructure/notification/web-push-sender';
import { PushSubscriptionController } from '../presentation/http/push-subscription/push-subscription.controller';

@Module({
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
  ],
  exports: [
    PUSH_SUBSCRIPTION_REPOSITORY,
    PUSH_SENDER,
    GetVapidPublicKeyUseCase,
    UpsertPushSubscriptionUseCase,
    DeletePushSubscriptionUseCase,
    SendPushToTeacherUseCase,
  ],
})
export class PushSubscriptionModule {}
