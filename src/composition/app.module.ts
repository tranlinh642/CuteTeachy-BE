import { Module } from '@nestjs/common';
import { SharedModule } from './shared.module';
import { HealthModule } from './health.module';
import { VerificationModule } from './verification.module';
import { AccountModule } from './account.module';
import { AvatarModule } from './avatar.module';
import { GoogleAuthModule } from './google-auth.module';
import { EmailVerificationModule } from './email-verification.module';
import { PasswordResetModule } from './password-reset.module';
import { TagModule } from './tag.module';
import { TaskModule } from './task.module';

@Module({
  imports: [
    SharedModule,
    HealthModule,
    VerificationModule,
    AccountModule,
    AvatarModule,
    GoogleAuthModule,
    EmailVerificationModule,
    PasswordResetModule,
    TagModule,
    TaskModule,
  ],
})
export class AppModule {}
