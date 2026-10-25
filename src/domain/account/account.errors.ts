import { DomainError } from '../shared/domain.error';

export class AccountValidationError extends DomainError {
  readonly code = 'validation';

  constructor(message: string) {
    super(message);
  }
}

export class EmailTakenError extends DomainError {
  readonly code = 'email_taken';

  constructor(message = 'Email is already registered') {
    super(message);
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly code = 'invalid_credentials';

  constructor(message = 'Invalid email or password') {
    super(message);
  }
}

export class UnauthorizedError extends DomainError {
  readonly code = 'unauthorized';

  constructor(message = 'Unauthorized') {
    super(message);
  }
}

export class RateLimitedError extends DomainError {
  readonly code = 'rate_limited';

  constructor(message = 'Too many requests, please try again later') {
    super(message);
  }
}

export class OnboardingRequiredError extends DomainError {
  readonly code = 'onboarding_required';

  constructor(message = 'Onboarding required') {
    super(message);
  }
}
