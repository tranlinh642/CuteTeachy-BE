import { DomainError } from '../shared/domain.error';

export class NoteValidationError extends DomainError {
  readonly code = 'validation';

  constructor(message: string) {
    super(message);
  }
}
