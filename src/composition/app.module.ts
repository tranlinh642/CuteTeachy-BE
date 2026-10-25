import { Module } from '@nestjs/common';
import { SharedModule } from './shared.module';
import { HealthModule } from './health.module';
import { AccountModule } from './account.module';

@Module({
  imports: [SharedModule, HealthModule, AccountModule],
})
export class AppModule {}
