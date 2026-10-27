import { DomainError } from '../shared/domain.error';

export class TimetableValidationError extends DomainError {
  readonly code = 'validation';

  constructor(message: string) {
    super(message);
  }
}

export class TimetableConflictError extends DomainError {
  readonly code = 'timetable_conflict';

  constructor(message = 'Timetable slot conflicts with an existing slot') {
    super(message);
  }
}

export class PayloadConflictError extends DomainError {
  readonly code = 'conflict';

  constructor(message = 'Payload differs from existing resource') {
    super(message);
  }
}
