import { DomainError } from '../shared/domain.error';

export class InvalidExchangeCodeError extends DomainError {
  readonly code = 'invalid_code';

  constructor(message = 'Invalid, expired, or already used exchange code') {
    super(message);
  }
}
