import { Module } from '@nestjs/common';
import { SharedModule } from './shared.module';
import { HealthModule } from './health.module';

@Module({
  imports: [SharedModule, HealthModule],
})
export class AppModule {}
