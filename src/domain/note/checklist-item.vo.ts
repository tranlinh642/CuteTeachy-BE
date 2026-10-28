import { NoteValidationError } from './note.errors';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ChecklistItem {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
}

export function validateChecklistItem(raw: unknown): ChecklistItem {
  if (typeof raw !== 'object' || raw === null) {
    throw new NoteValidationError('Checklist item must be an object');
  }

  const { id, text, done } = raw as Record<string, unknown>;

  if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
    throw new NoteValidationError('Checklist item id must be a valid UUID');
  }

  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new NoteValidationError('Checklist item text cannot be empty');
  }

  if (typeof done !== 'boolean') {
    throw new NoteValidationError('Checklist item done must be a boolean');
  }

  return {
    id,
    text: text.trim(),
    done,
  };
}
