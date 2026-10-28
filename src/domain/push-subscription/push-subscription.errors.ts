import { DomainError } from '../shared/domain.error';

export class PushSubscriptionValidationError extends DomainError {
  readonly code = 'validation';

  constructor(message: string) {
    super(message);
  }
}
