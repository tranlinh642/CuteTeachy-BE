export interface SyncEnvelope<T> {
  items: T[];
  deletedIds: string[];
  nextCursor?: string;
  serverTime: string;
}
