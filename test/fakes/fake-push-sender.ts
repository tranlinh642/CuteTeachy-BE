import {
  PushSender,
  PushSubscriptionExpiredError,
  PushSubscriptionTarget,
} from '../../src/application/push-subscription/ports/push-sender.port';
import { PushPayload } from '../../src/application/push-subscription/push-subscription.dto';

export interface SentPushRecord {
  target: PushSubscriptionTarget;
  payload: PushPayload;
}

export class FakePushSender implements PushSender {
  private publicKey = 'test-vapid-public-key';
  private readonly expiredEndpoints = new Set<string>();
  private readonly failedEndpoints = new Map<string, Error>();
  private readonly sentRecords: SentPushRecord[] = [];

  constructor(publicKey?: string) {
    if (publicKey) {
      this.publicKey = publicKey;
    }
  }

  getVapidPublicKey(): string {
    return this.publicKey;
  }

  setVapidPublicKey(key: string): void {
    this.publicKey = key;
  }

  markExpired(endpoint: string): void {
    this.expiredEndpoints.add(endpoint);
  }

  markFailed(endpoint: string, error?: Error): void {
    this.failedEndpoints.set(endpoint, error ?? new Error(`Push delivery failed for ${endpoint}`));
  }

  async send(target: PushSubscriptionTarget, payload: PushPayload): Promise<void> {
    if (this.expiredEndpoints.has(target.endpoint)) {
      throw new PushSubscriptionExpiredError(target.endpoint);
    }

    const failedError = this.failedEndpoints.get(target.endpoint);
    if (failedError) {
      throw failedError;
    }

    this.sentRecords.push({
      target,
      payload,
    });
  }

  getSentMessages(): SentPushRecord[] {
    return [...this.sentRecords];
  }

  getSentTo(endpoint: string): SentPushRecord[] {
    return this.sentRecords.filter((r) => r.target.endpoint === endpoint);
  }

  clear(): void {
    this.expiredEndpoints.clear();
    this.failedEndpoints.clear();
    this.sentRecords.length = 0;
  }
}
