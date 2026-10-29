import { InAppNotification } from '../../domain/notification/in-app-notification.entity';
import { PushSubscriptionValidationError } from '../../domain/push-subscription/push-subscription.errors';
import { InAppNotificationRepository } from '../notification/ports/in-app-notification.repository.port';
import { TeacherSettingsReader } from '../settings/ports/teacher-settings.port';
import { Clock } from '../shared/ports/clock.port';
import { IdGenerator } from '../shared/ports/id-generator.port';
import { SendPushToTeacherUseCase } from './send-push-to-teacher.use-case';

export interface SendTestNotificationInput {
  accountId: string;
}

export interface SendTestNotificationOutput {
  sent: number;
  failed: number;
  inAppCreated: boolean;
}

export class SendTestNotificationUseCase {
  constructor(
    private readonly inAppNotificationRepo: InAppNotificationRepository,
    private readonly sendPushUseCase: SendPushToTeacherUseCase,
    private readonly settingsReader: TeacherSettingsReader,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(input: SendTestNotificationInput): Promise<SendTestNotificationOutput> {
    if (!input.accountId || typeof input.accountId !== 'string' || !input.accountId.trim()) {
      throw new PushSubscriptionValidationError('accountId is required');
    }

    const accountId = input.accountId.trim();
    const settings = await this.settingsReader.getSettings(accountId);
    const isEn = settings?.locale === 'en';

    const title = isEn
      ? 'Test notification from CuteTeachy'
      : 'Thông báo thử nghiệm từ CuteTeachy';
    const body = isEn
      ? 'Your device is connected to the notification system successfully!'
      : 'Thiết bị của bạn đã kết nối hệ thống thông báo thành công!';
    const url = '/';
    const data = { type: 'system', test: true, url };

    const notification = InAppNotification.create({
      id: this.idGenerator.next(),
      accountId,
      type: 'system',
      targetId: null,
      title,
      body,
      url,
      data,
      now: this.clock.now(),
    });

    await this.inAppNotificationRepo.save(notification);

    const pushResult = await this.sendPushUseCase.execute({
      accountId,
      payload: {
        title,
        body,
        url,
        data,
      },
    });

    return {
      sent: pushResult.sent,
      failed: pushResult.failed,
      inAppCreated: true,
    };
  }
}
