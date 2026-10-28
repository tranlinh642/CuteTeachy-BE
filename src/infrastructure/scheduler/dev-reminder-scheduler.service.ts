import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config/app.config';
import { DispatchRemindersUseCase } from '../../application/reminder/dispatch-reminders.use-case';

@Injectable()
export class DevReminderSchedulerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(DevReminderSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly dispatchRemindersUseCase: DispatchRemindersUseCase,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.NODE_ENV === 'development') {
      this.logger.log('Starting dev reminder scheduler (interval: 60s)...');
      this.timer = setInterval(async () => {
        try {
          const result = await this.dispatchRemindersUseCase.execute();
          if (result.sent > 0) {
            this.logger.log(
              `[DevScheduler] Dispatched ${result.sent} reminder(s), skipped ${result.skipped}`,
            );
          }
        } catch (err: any) {
          this.logger.error(`[DevScheduler] Error dispatching reminders: ${err.message}`, err.stack);
        }
      }, 60000);

      if (this.timer.unref) {
        this.timer.unref();
      }
    }
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
