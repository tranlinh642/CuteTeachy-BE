import { DomainError } from '../shared/domain.error';

export class SettingsValidationError extends DomainError {
  readonly code = 'validation';

  constructor(message: string) {
    super(message);
  }
}

export class SettingsNotFoundError extends DomainError {
  readonly code = 'not_found';

  constructor(message = 'Settings not found') {
    super(message);
  }
}
