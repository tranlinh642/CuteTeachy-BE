import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
  ValidationError,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
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

  const httpAdapter = app.getHttpAdapter?.();
  const instance = httpAdapter?.getInstance?.();
  if (instance && typeof instance.set === 'function') {
    instance.set('trust proxy', 1);
  }

  if (config.INTERNAL_PROXY_SECRET && instance && typeof instance.use === 'function') {
    instance.use((req: Request, res: Response, next: NextFunction) => {
      const reqPath = req.path || req.url || '';
      if (reqPath.startsWith('/internal/reminders/dispatch')) {
        return next();
      }
      const providedSecret = req.headers['x-internal-proxy-secret'];
      if (providedSecret !== config.INTERNAL_PROXY_SECRET) {
        return res.status(403).json({
          code: 'forbidden',
          message: 'Direct backend access is not allowed',
        });
      }
      return next();
    });
  }

  const allowedOrigins = config.FE_URL.split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language', 'X-Internal-Proxy-Secret'],
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
