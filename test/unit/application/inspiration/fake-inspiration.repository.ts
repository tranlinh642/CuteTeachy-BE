import type { InspirationRepository } from '../../../../src/application/inspiration/ports/inspiration.repository.port';
import { Inspiration } from '../../../../src/domain/inspiration/inspiration.entity';

export class FakeInspirationRepository implements InspirationRepository {
  private readonly store = new Map<string, Inspiration>();

  async findAll(): Promise<Inspiration[]> {
    const list = Array.from(this.store.values());
    list.sort((a, b) => a.id.localeCompare(b.id));
    return list.map((item) =>
      Inspiration.reconstitute({
        id: item.id,
        quoteVi: item.quoteVi,
        quoteEn: item.quoteEn,
        author: item.author,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }),
    );
  }

  async findById(id: string): Promise<Inspiration | null> {
    const found = this.store.get(id);
    if (!found) return null;
    return Inspiration.reconstitute({
      id: found.id,
      quoteVi: found.quoteVi,
      quoteEn: found.quoteEn,
      author: found.author,
      createdAt: found.createdAt,
      updatedAt: found.updatedAt,
    });
  }

  async save(inspiration: Inspiration): Promise<void> {
    const clone = Inspiration.reconstitute({
      id: inspiration.id,
      quoteVi: inspiration.quoteVi,
      quoteEn: inspiration.quoteEn,
      author: inspiration.author,
      createdAt: inspiration.createdAt,
      updatedAt: inspiration.updatedAt,
    });
    this.store.set(inspiration.id, clone);
  }

  seed(inspirations: Inspiration[]): void {
    this.store.clear();
    for (const insp of inspirations) {
      this.store.set(insp.id, insp);
    }
  }

  clear(): void {
    this.store.clear();
  }
}
