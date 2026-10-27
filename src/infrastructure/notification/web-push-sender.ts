import { Inject, Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import {
  PushSender,
  PushSubscriptionExpiredError,
  PushSubscriptionTarget,
} from '../../application/push-subscription/ports/push-sender.port';
import { PushPayload } from '../../application/push-subscription/push-subscription.dto';
import { APP_CONFIG, AppConfig } from '../config/app.config';

@Injectable()
export class WebPushSender implements PushSender {
  private readonly logger = new Logger(WebPushSender.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  getVapidPublicKey(): string {
    return this.config.VAPID_PUBLIC_KEY;
  }

  async send(target: PushSubscriptionTarget, payload: PushPayload): Promise<void> {
    try {
      await webpush.sendNotification(
        {
          endpoint: target.endpoint,
          keys: {
            p256dh: target.keys.p256dh,
            auth: target.keys.auth,
          },
        },
        JSON.stringify(payload),
        {
          vapidDetails: {
            subject: this.config.VAPID_SUBJECT,
            publicKey: this.config.VAPID_PUBLIC_KEY,
            privateKey: this.config.VAPID_PRIVATE_KEY,
          },
        },
      );
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        this.logger.warn(
          `Push subscription expired for endpoint ${target.endpoint} (${error.statusCode})`,
        );
        throw new PushSubscriptionExpiredError(target.endpoint, error.message);
      }
      this.logger.error(
        `Failed to send web push to ${target.endpoint}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
