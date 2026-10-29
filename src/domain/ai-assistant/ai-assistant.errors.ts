import { DomainError } from '../shared/domain.error';

export class AiAssistantValidationError extends DomainError {
  readonly code = 'validation_error';

  constructor(message: string) {
    super(message);
  }
}

export class AiMessageNotFoundError extends DomainError {
  readonly code = 'not_found';

  constructor(message = 'AI chat message not found') {
    super(message);
  }
}

export class AiDraftAlreadyAppliedError extends DomainError {
  readonly code = 'ai_draft_already_applied';

  constructor(message = 'AI schedule draft has already been applied') {
    super(message);
  }
}

export class AiProviderNotConfiguredError extends DomainError {
  readonly code = 'ai_provider_not_configured';

  constructor(
    message = 'AI Assistant is not configured on the server (missing GEMINI_API_KEY)',
  ) {
    super(message);
  }
}

export class AiProviderError extends DomainError {
  readonly code = 'ai_provider_error';

  constructor(message = 'Failed to communicate with AI provider') {
    super(message);
  }
}
