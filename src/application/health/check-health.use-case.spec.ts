import { CheckHealthUseCase } from './check-health.use-case';
import { InMemoryHealthChecker } from '../../../test/fakes/in-memory-health-checker';

describe('CheckHealthUseCase', () => {
  it('returns true when health checker reports healthy', async () => {
    const fakeChecker = new InMemoryHealthChecker(true);
    const useCase = new CheckHealthUseCase(fakeChecker);

    const result = await useCase.execute();

    expect(result).toBe(true);
  });

  it('returns false when health checker reports unhealthy', async () => {
    const fakeChecker = new InMemoryHealthChecker(false);
    const useCase = new CheckHealthUseCase(fakeChecker);

    const result = await useCase.execute();

    expect(result).toBe(false);
  });
});
