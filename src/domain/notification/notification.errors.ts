import { DomainError } from '../shared/domain.error';

export class NotificationValidationError extends DomainError {
  readonly code = 'validation';

  constructor(message: string) {
    super(message);
  }
}

export class NotificationNotFoundError extends DomainError {
  readonly code = 'not_found';

  constructor(message = 'Notification not found') {
    super(message);
  }
}
