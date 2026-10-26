import { DomainError } from '../shared/domain.error';

export class TagNameTakenError extends DomainError {
  readonly code = 'tag_name_taken';

  constructor(message = 'Tag name is already taken') {
    super(message);
  }
}

export class TagValidationError extends DomainError {
  readonly code = 'validation';

  constructor(message: string) {
    super(message);
  }
}
