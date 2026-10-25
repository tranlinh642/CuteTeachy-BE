import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './composition/app.module';
import { setupApp } from './setup-app';
import { APP_CONFIG, AppConfig } from './infrastructure/config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.PORT);
  const logger = new Logger('Bootstrap');
  logger.log(`CuteTeachy-BE is listening on port ${config.PORT}`);
}

bootstrap();
