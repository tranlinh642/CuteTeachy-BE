import { GetTodayInspirationUseCase } from '../../../../src/application/inspiration/get-today-inspiration.use-case';
import { FakeInspirationRepository } from './fake-inspiration.repository';
import { InMemorySettingsRepository } from '../../../fakes/in-memory-settings.repository';
import { FixedClock } from '../../../fakes/fixed-clock';
import { Inspiration } from '../../../../src/domain/inspiration/inspiration.entity';
import { Settings } from '../../../../src/domain/settings/settings.entity';
import { InspirationNotFoundError } from '../../../../src/domain/inspiration/inspiration.errors';

describe('GetTodayInspirationUseCase', () => {
  let inspirationRepository: FakeInspirationRepository;
  let settingsRepository: InMemorySettingsRepository;

  const seedNow = new Date('2026-01-01T00:00:00Z');

  const mockQuotes = [
    Inspiration.create({
      id: 'insp-1',
      quoteVi: 'Ảnh hưởng của một người thầy tốt không bao giờ phai nhạt.',
      quoteEn: 'The influence of a good teacher can never be erased.',
      author: 'Unknown 1',
      now: seedNow,
    }),
    Inspiration.create({
      id: 'insp-2',
      quoteVi: 'Dạy học là gieo hạt giống cho ngày mai.',
      quoteEn: 'To teach is to touch a life forever.',
      author: 'Unknown 2',
      now: seedNow,
    }),
    Inspiration.create({
      id: 'insp-3',
      quoteVi: 'Mỗi ngày là một cơ hội mới để truyền cảm hứng.',
      quoteEn: 'Every day is a new chance to inspire.',
      author: 'Unknown 3',
      now: seedNow,
    }),
  ];

  beforeEach(() => {
    inspirationRepository = new FakeInspirationRepository();
    settingsRepository = new InMemorySettingsRepository();
    inspirationRepository.seed(mockQuotes);
  });

  it('selects quote based on (dayOfYear - 1) % quotes.length for teacher timezone', async () => {
    // 2026-01-01 at 12:00:00 UTC -> dayOfYear = 1.
    // (1 - 1) % 3 = 0 -> quotes[0] ('insp-1')
    const clock = new FixedClock(new Date('2026-01-01T12:00:00Z'));
    const useCase = new GetTodayInspirationUseCase(settingsRepository, inspirationRepository, clock);

    await settingsRepository.save(
      Settings.createDefault('teacher-1', {
        timeZone: 'Asia/Ho_Chi_Minh',
        now: clock.now(),
      }),
    );

    const result = await useCase.execute({ accountId: 'teacher-1' });

    expect(result.id).toBe('insp-1');
    expect(result.quote.vi).toBe('Ảnh hưởng của một người thầy tốt không bao giờ phai nhạt.');
    expect(result.quote.en).toBe('The influence of a good teacher can never be erased.');
    expect(result.author).toBe('Unknown 1');
  });

  it('always returns the same quote for different requests on the same local day', async () => {
    // Morning in Ho Chi Minh
    const clockMorning = new FixedClock(new Date('2026-10-26T01:00:00Z')); // 8:00 AM VN
    const useCaseMorning = new GetTodayInspirationUseCase(
      settingsRepository,
      inspirationRepository,
      clockMorning,
    );

    await settingsRepository.save(
      Settings.createDefault('teacher-1', {
        timeZone: 'Asia/Ho_Chi_Minh',
        now: clockMorning.now(),
      }),
    );

    const resultMorning = await useCaseMorning.execute({ accountId: 'teacher-1' });

    // Evening in Ho Chi Minh on same date
    const clockEvening = new FixedClock(new Date('2026-10-26T14:00:00Z')); // 9:00 PM VN
    const useCaseEvening = new GetTodayInspirationUseCase(
      settingsRepository,
      inspirationRepository,
      clockEvening,
    );

    await settingsRepository.save(
      Settings.createDefault('teacher-1', {
        timeZone: 'Asia/Ho_Chi_Minh',
        now: clockEvening.now(),
      }),
    );

    const resultEvening = await useCaseEvening.execute({ accountId: 'teacher-1' });

    expect(resultMorning.id).toBe(resultEvening.id);
  });

  it('delivers different quotes for teachers in different timezones around UTC midnight', async () => {
    // At UTC 2026-10-26 21:30:00:
    // - In Asia/Ho_Chi_Minh (UTC+7): 2026-10-27 04:30:00 -> dayOfYear = 300
    //   (300 - 1) % 3 = 299 % 3 = 2 -> quotes[2] ('insp-3')
    // - In America/New_York (UTC-4): 2026-10-26 17:30:00 -> dayOfYear = 299
    //   (299 - 1) % 3 = 298 % 3 = 1 -> quotes[1] ('insp-2')
    const clock = new FixedClock(new Date('2026-10-26T21:30:00Z'));
    const useCase = new GetTodayInspirationUseCase(settingsRepository, inspirationRepository, clock);

    await settingsRepository.save(
      Settings.createDefault('teacher-vn', {
        timeZone: 'Asia/Ho_Chi_Minh',
        now: clock.now(),
      }),
    );
    await settingsRepository.save(
      Settings.createDefault('teacher-ny', {
        timeZone: 'America/New_York',
        now: clock.now(),
      }),
    );

    const resultVn = await useCase.execute({ accountId: 'teacher-vn' });
    const resultNy = await useCase.execute({ accountId: 'teacher-ny' });

    expect(resultVn.id).toBe('insp-3');
    expect(resultNy.id).toBe('insp-2');
    expect(resultVn.id).not.toBe(resultNy.id);
  });

  it('falls back to Asia/Ho_Chi_Minh timezone when teacher has no settings record', async () => {
    // 2026-10-26 21:30:00 UTC -> 2026-10-27 04:30:00 in Asia/Ho_Chi_Minh -> dayOfYear = 300
    // (300 - 1) % 3 = 2 -> 'insp-3'
    const clock = new FixedClock(new Date('2026-10-26T21:30:00Z'));
    const useCase = new GetTodayInspirationUseCase(settingsRepository, inspirationRepository, clock);

    const result = await useCase.execute({ accountId: 'teacher-no-settings' });

    expect(result.id).toBe('insp-3');
  });

  it('throws InspirationNotFoundError when repository has no quotes', async () => {
    inspirationRepository.clear();
    const clock = new FixedClock(new Date('2026-10-26T12:00:00Z'));
    const useCase = new GetTodayInspirationUseCase(settingsRepository, inspirationRepository, clock);

    await expect(useCase.execute({ accountId: 'teacher-1' })).rejects.toThrow(
      InspirationNotFoundError,
    );
  });
});
