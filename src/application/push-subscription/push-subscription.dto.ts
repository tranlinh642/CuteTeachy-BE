export interface PushSubscriptionKeysDto {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionDto {
  id: string;
  accountId: string;
  endpoint: string;
  keys: PushSubscriptionKeysDto;
  createdAt: string;
  updatedAt: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
}
