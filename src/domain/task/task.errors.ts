import { DomainError } from '../shared/domain.error';

export class TaskValidationError extends DomainError {
  readonly code = 'validation';

  constructor(message: string) {
    super(message);
  }
}
