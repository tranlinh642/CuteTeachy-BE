import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CRON_SECRET_VERIFIER,
  CronSecretVerifier,
} from '../../../../application/reminder/ports/cron-secret-verifier.port';

@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(
    @Inject(CRON_SECRET_VERIFIER)
    private readonly verifier: CronSecretVerifier,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const cronSecretHeader =
      request?.headers?.['x-cron-secret'] || request?.headers?.['X-Cron-Secret'];

    if (!cronSecretHeader || typeof cronSecretHeader !== 'string') {
      throw new UnauthorizedException('Missing X-Cron-Secret header');
    }

    if (!this.verifier.verify(cronSecretHeader)) {
      throw new UnauthorizedException('Invalid X-Cron-Secret header');
    }

    return true;
  }
}
