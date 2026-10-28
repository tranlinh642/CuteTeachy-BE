import { DomainError } from '../shared/domain.error';

export class InspirationNotFoundError extends DomainError {
  readonly code = 'not_found';

  constructor(message = 'No inspiration found') {
    super(message);
  }
}

export class InspirationValidationError extends DomainError {
  readonly code = 'validation';

  constructor(message: string) {
    super(message);
  }
}
