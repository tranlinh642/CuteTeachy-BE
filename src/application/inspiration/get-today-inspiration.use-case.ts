import type { TeacherSettingsReader } from '../settings/ports/teacher-settings.port';
import type { InspirationRepository } from './ports/inspiration.repository.port';
import type { Clock } from '../shared/ports/clock.port';
import { calculateTeacherToday } from '../../domain/settings/teacher-today.helper';
import { InspirationNotFoundError } from '../../domain/inspiration/inspiration.errors';
import type { InspirationDto } from './inspiration.dto';

export interface GetTodayInspirationInput {
  accountId: string;
}

export class GetTodayInspirationUseCase {
  constructor(
    private readonly teacherSettingsReader: TeacherSettingsReader,
    private readonly inspirationRepository: InspirationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: GetTodayInspirationInput): Promise<InspirationDto> {
    const settings = await this.teacherSettingsReader.getSettings(input.accountId);
    const timeZone = settings?.timeZone ?? 'Asia/Ho_Chi_Minh';
    const now = this.clock.now();
    const today = calculateTeacherToday(now, timeZone);

    const quotes = await this.inspirationRepository.findAll();
    if (!quotes || quotes.length === 0) {
      throw new InspirationNotFoundError('No inspirations available');
    }

    const index = today.dayOfYear % quotes.length;
    const selected = quotes[index];

    return {
      id: selected.id,
      quote: selected.quote,
      quoteVi: selected.quoteVi,
      quoteEn: selected.quoteEn,
      author: selected.author,
    };
  }
}
