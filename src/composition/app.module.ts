import { Module } from '@nestjs/common';
import { SharedModule } from './shared.module';
import { HealthModule } from './health.module';
import { AccountModule } from './account.module';
import { AvatarModule } from './avatar.module';

@Module({
  imports: [SharedModule, HealthModule, AccountModule, AvatarModule],
})
export class AppModule {}
