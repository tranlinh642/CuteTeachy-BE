import { EntityNotFoundError } from '../../domain/shared/sync.errors';
import { calculateTeacherToday } from '../../domain/settings/teacher-today.helper';
import { getPreviousDay } from '../../domain/timetable/timetable-date.helper';
import { planSlotDeletion } from '../../domain/timetable/timetable-slot-modifier';
import type { Clock } from '../shared/ports/clock.port';
import type { UnitOfWork } from '../shared/ports/unit-of-work.port';
import type { TeacherSettingsReader } from '../settings/ports/teacher-settings.port';

export interface DeleteTimetableSlotInput {
  id: string;
  accountId: string;
}

export class DeleteTimetableSlotUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly teacherSettingsReader: TeacherSettingsReader,
    private readonly clock: Clock,
  ) {}

  async execute(input: DeleteTimetableSlotInput): Promise<void> {
    const settings = await this.teacherSettingsReader.getSettings(input.accountId);
    const timeZone = settings?.timeZone ?? 'Asia/Ho_Chi_Minh';
    const now = this.clock.now();
    const today = calculateTeacherToday(now, timeZone).dateString;
    const yesterday = getPreviousDay(today);

    await this.uow.run(async (repos) => {
      const slot = await repos.timetableSlotRepo.findById(input.id);
      if (!slot || slot.accountId !== input.accountId) {
        throw new EntityNotFoundError('Timetable slot not found');
      }

      const plan = planSlotDeletion(slot, today, yesterday, now);
      if (plan.type === 'noop') {
        return;
      }

      await repos.timetableSlotRepo.save(plan.slot);

      // Discard future overrides belonging to the ended/deleted slot
      await repos.classSessionRepo.deleteOverridesBySlotFromDate(plan.slot.id, today);
    });
  }
}
