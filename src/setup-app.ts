import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
  ValidationError,
} from '@nestjs/common';
import { APP_CONFIG, AppConfig } from './infrastructure/config/app.config';
import { GlobalExceptionFilter } from './presentation/http/filters/domain-error.filter';

function collectValidationErrors(errors: ValidationError[]): string[] {
  const messages: string[] = [];
  for (const error of errors) {
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }
    if (error.children && error.children.length > 0) {
      messages.push(...collectValidationErrors(error.children));
    }
  }
  return messages;
}

export function setupApp(app: INestApplication): void {
  const config = app.get<AppConfig>(APP_CONFIG);

  app.enableCors({
    origin: config.FE_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const messages = collectValidationErrors(errors);
        return new BadRequestException({
          code: 'validation',
          message: messages.join('; ') || 'Validation failed',
        });
      },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
}
