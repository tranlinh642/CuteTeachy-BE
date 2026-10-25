import { DomainError } from '../shared/domain.error';

export class FileTooLargeError extends DomainError {
  readonly code = 'file_too_large';

  constructor(message = 'File size exceeds 2 MB limit') {
    super(message);
  }
}

export class UnsupportedFileTypeError extends DomainError {
  readonly code = 'unsupported_file_type';

  constructor(message = 'File type must be JPEG, PNG, or WebP') {
    super(message);
  }
}

export class AvatarNotFoundError extends DomainError {
  readonly code = 'not_found';

  constructor(message = 'Avatar not found') {
    super(message);
  }
}
