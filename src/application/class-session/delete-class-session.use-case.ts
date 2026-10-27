import { CannotDeleteGeneratedSessionError } from '../../domain/class-session/class-session.errors';
import { EntityNotFoundError } from '../../domain/shared/sync.errors';
import type { Clock } from '../shared/ports/clock.port';
import type { ClassSessionRepository } from './ports/class-session.repository.port';

export interface DeleteClassSessionInput {
  id: string;
  accountId: string;
}

export class DeleteClassSessionUseCase {
  constructor(
    private readonly sessionRepo: ClassSessionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: DeleteClassSessionInput): Promise<void> {
    if (input.id.includes(':')) {
      throw new CannotDeleteGeneratedSessionError('Cannot delete a generated class session');
    }

    const session = await this.sessionRepo.findById(input.id);
    if (!session || session.accountId !== input.accountId) {
      throw new EntityNotFoundError('Class session not found');
    }

    if (session.isOverride()) {
      throw new CannotDeleteGeneratedSessionError('Cannot delete a generated class session');
    }

    if (session.isDeleted()) {
      return;
    }

    session.delete(this.clock.now());
    await this.sessionRepo.save(session);
  }
}
