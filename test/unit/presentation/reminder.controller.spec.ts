import { ReminderController } from '../../../src/presentation/http/reminder/reminder.controller';
import { DispatchRemindersUseCase } from '../../../src/application/reminder/dispatch-reminders.use-case';

describe('ReminderController', () => {
  let controller: ReminderController;
  let useCase: DispatchRemindersUseCase;

  beforeEach(() => {
    useCase = {
      execute: jest.fn().mockResolvedValue({ sent: 3, skipped: 1 }),
    } as unknown as DispatchRemindersUseCase;

    controller = new ReminderController(useCase);
  });

  it('delegates dispatch to DispatchRemindersUseCase and returns result', async () => {
    const result = await controller.dispatch();

    expect(useCase.execute).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ sent: 3, skipped: 1 });
  });
});
