import { DomainError } from '../shared/domain.error';

export class ClassSessionValidationError extends DomainError {
  readonly code = 'validation';

  constructor(message: string) {
    super(message);
  }
}

export class CannotDeleteGeneratedSessionError extends DomainError {
  readonly code = 'cannot_delete_generated_session';

  constructor(message = 'Cannot delete a generated class session') {
    super(message);
  }
}

export class PayloadConflictError extends DomainError {
  readonly code = 'conflict';

  constructor(message = 'Payload differs from existing resource') {
    super(message);
  }
}
