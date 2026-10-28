import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '../../../domain/shared/domain.error';
import { getStatusForDomainError } from './error-status.map';

export interface ErrorResponse {
  code: string;
  message: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ErrorResponse = {
      code: 'unknown',
      message: 'Internal server error',
    };

    if (exception instanceof DomainError) {
      status = getStatusForDomainError(exception.code);
      body = {
        code: exception.code,
        message: exception.message,
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        if (resObj.code) {
          body = {
            code: String(resObj.code),
            message: Array.isArray(resObj.message)
              ? resObj.message.join('; ')
              : String(resObj.message || exception.message),
          };
        } else if (status === HttpStatus.BAD_REQUEST) {
          body = {
            code: 'validation',
            message: Array.isArray(resObj.message)
              ? resObj.message.join('; ')
              : String(resObj.message || 'Validation failed'),
          };
        } else {
          body = {
            code: status === HttpStatus.SERVICE_UNAVAILABLE ? 'service_unavailable' : 'error',
            message: Array.isArray(resObj.message)
              ? resObj.message.join('; ')
              : String(resObj.message || exception.message),
          };
        }
      } else {
        body = {
          code: status === HttpStatus.BAD_REQUEST ? 'validation' : 'error',
          message: String(res),
        };
      }
    } else {
      this.logger.error(
        'Unhandled exception caught in GlobalExceptionFilter',
        exception instanceof Error ? exception.stack : exception,
      );
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      body = {
        code: 'unknown',
        message: 'Internal server error',
      };
    }

    response.status(status).json(body);
  }
}
