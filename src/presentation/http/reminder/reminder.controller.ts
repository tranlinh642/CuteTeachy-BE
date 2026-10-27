import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { DispatchRemindersUseCase } from '../../../application/reminder/dispatch-reminders.use-case';
import { CronSecretGuard } from './guards/cron-secret.guard';
import { Public } from '../auth/public.decorator';
import { DispatchRemindersResponseDto } from './reminder.dto';

@Controller('internal/reminders')
export class ReminderController {
  constructor(private readonly dispatchRemindersUseCase: DispatchRemindersUseCase) {}

  @Post('dispatch')
  @Public()
  @UseGuards(CronSecretGuard)
  @HttpCode(HttpStatus.OK)
  async dispatch(): Promise<DispatchRemindersResponseDto> {
    const result = await this.dispatchRemindersUseCase.execute();
    return {
      sent: result.sent,
      skipped: result.skipped,
    };
  }
}
