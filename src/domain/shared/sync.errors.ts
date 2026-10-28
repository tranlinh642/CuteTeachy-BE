import { DomainError } from './domain.error';

export class EntityGoneError extends DomainError {
  readonly code = 'gone';

  constructor(message = 'Resource has been deleted') {
    super(message);
  }
}

export class IdConflictError extends DomainError {
  readonly code = 'id_conflict';

  constructor(message = 'Resource id belongs to another account') {
    super(message);
  }
}

export class SyncValidationError extends DomainError {
  readonly code = 'validation';

  constructor(message: string) {
    super(message);
  }
}

export class EntityNotFoundError extends DomainError {
  readonly code = 'not_found';

  constructor(message = 'Resource not found') {
    super(message);
  }
}
