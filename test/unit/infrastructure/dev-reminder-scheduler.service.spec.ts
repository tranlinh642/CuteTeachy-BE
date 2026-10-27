import { DevReminderSchedulerService } from '../../../src/infrastructure/scheduler/dev-reminder-scheduler.service';
import { AppConfig } from '../../../src/infrastructure/config/app.config';
import { DispatchRemindersUseCase } from '../../../src/application/reminder/dispatch-reminders.use-case';

describe('DevReminderSchedulerService', () => {
  let useCase: DispatchRemindersUseCase;

  beforeEach(() => {
    jest.useFakeTimers();
    useCase = {
      execute: jest.fn().mockResolvedValue({ sent: 1, skipped: 0 }),
    } as unknown as DispatchRemindersUseCase;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does NOT start interval when NODE_ENV is test or production', () => {
    const config = { NODE_ENV: 'test' } as AppConfig;
    const service = new DevReminderSchedulerService(config, useCase);

    service.onApplicationBootstrap();
    jest.advanceTimersByTime(120000);

    expect(useCase.execute).not.toHaveBeenCalled();
    service.onApplicationShutdown();
  });

  it('starts interval when NODE_ENV is development and calls dispatchRemindersUseCase', () => {
    const config = { NODE_ENV: 'development' } as AppConfig;
    const service = new DevReminderSchedulerService(config, useCase);

    service.onApplicationBootstrap();
    expect(useCase.execute).not.toHaveBeenCalled();

    // Advance 60s
    jest.advanceTimersByTime(60000);
    expect(useCase.execute).toHaveBeenCalledTimes(1);

    // Advance another 60s
    jest.advanceTimersByTime(60000);
    expect(useCase.execute).toHaveBeenCalledTimes(2);

    service.onApplicationShutdown();
    jest.advanceTimersByTime(60000);
    // Still 2 after shutdown
    expect(useCase.execute).toHaveBeenCalledTimes(2);
  });
});
