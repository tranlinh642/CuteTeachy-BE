import { ClassSessionValidationError } from './class-session.errors';

export interface PrepItem {
  readonly id: string;
  readonly label: string;
  readonly done: boolean;
}

export function validatePrepItem(raw: unknown, index?: number): PrepItem {
  if (typeof raw !== 'object' || raw === null) {
    throw new ClassSessionValidationError(
      `prepItem${index !== undefined ? ` at index ${index}` : ''} must be an object`,
    );
  }

  const { id, label, done } = raw as Record<string, unknown>;

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new ClassSessionValidationError('prepItem id must be a non-empty string');
  }

  if (typeof label !== 'string' || label.trim().length === 0) {
    throw new ClassSessionValidationError('prepItem label cannot be empty');
  }

  if (typeof done !== 'boolean') {
    throw new ClassSessionValidationError('prepItem done must be a boolean');
  }

  return {
    id: id.trim(),
    label: label.trim(),
    done,
  };
}

export function validatePrepItems(raw: unknown): PrepItem[] {
  if (!Array.isArray(raw)) {
    throw new ClassSessionValidationError('prepItems must be an array');
  }

  if (raw.length > 100) {
    throw new ClassSessionValidationError('prepItems cannot exceed 100 items');
  }

  return raw.map((item, index) => validatePrepItem(item, index));
}
