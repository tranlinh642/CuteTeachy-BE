import type { Inspiration } from '../../../domain/inspiration/inspiration.entity';

export const INSPIRATION_REPOSITORY = Symbol('INSPIRATION_REPOSITORY');

export interface InspirationRepository {
  findAll(): Promise<Inspiration[]>;
  findById(id: string): Promise<Inspiration | null>;
  save(inspiration: Inspiration): Promise<void>;
}
