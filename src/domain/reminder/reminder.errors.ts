import { DomainError } from '../shared/domain.error';

export class ReminderValidationError extends DomainError {
  readonly code = 'validation';

  constructor(message: string) {
    super(message);
  }
}
