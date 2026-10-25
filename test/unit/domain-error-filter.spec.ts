import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { DomainError } from '../../src/domain/shared/domain.error';
import { GlobalExceptionFilter } from '../../src/presentation/http/filters/domain-error.filter';

class TestDomainError extends DomainError {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockStatus: jest.Mock;
  let mockJson: jest.Mock;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    const mockResponse = {
      status: mockStatus,
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
      }),
    } as unknown as ArgumentsHost;
  });

  it('maps DomainError with code "email_taken" to HTTP 409', () => {
    const error = new TestDomainError('email_taken', 'Email already taken');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockJson).toHaveBeenCalledWith({
      code: 'email_taken',
      message: 'Email already taken',
    });
  });

  it('maps DomainError with code "invalid_credentials" to HTTP 401', () => {
    const error = new TestDomainError('invalid_credentials', 'Invalid credentials');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockJson).toHaveBeenCalledWith({
      code: 'invalid_credentials',
      message: 'Invalid credentials',
    });
  });

  it('maps DomainError with code "invalid_code" to HTTP 401', () => {
    const error = new TestDomainError('invalid_code', 'Invalid, expired, or already used exchange code');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockJson).toHaveBeenCalledWith({
      code: 'invalid_code',
      message: 'Invalid, expired, or already used exchange code',
    });
  });

  it('maps validation BadRequestException to 400 with code "validation"', () => {
    const error = new HttpException(
      { code: 'validation', message: 'Name must not be empty' },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith({
      code: 'validation',
      message: 'Name must not be empty',
    });
  });

  it('maps unhandled error to 500 with code "unknown" without exposing stack', () => {
    const error = new Error('Unexpected database connection crash with secret /etc/passwd');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith({
      code: 'unknown',
      message: 'Internal server error',
    });
    // Check no stack or internal details in response
    const jsonArg = mockJson.mock.calls[0][0];
    expect(jsonArg.stack).toBeUndefined();
    expect(jsonArg.message).not.toContain('secret');
  });
});
