import { SyncValidationError } from './sync.errors';

export const MAX_SYNC_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

export function parseAndValidateUpdatedSince(
  updatedSinceStr: string | undefined,
  now: Date,
): Date | undefined {
  if (updatedSinceStr === undefined || updatedSinceStr === null || updatedSinceStr.trim() === '') {
    return undefined;
  }

  const parsed = new Date(updatedSinceStr);
  if (isNaN(parsed.getTime())) {
    throw new SyncValidationError('Invalid updatedSince date string');
  }

  const diff = now.getTime() - parsed.getTime();
  if (diff > MAX_SYNC_WINDOW_MS) {
    throw new SyncValidationError('updatedSince cannot be older than 30 days');
  }

  return parsed;
}
