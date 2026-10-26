import { Inspiration as PrismaInspiration, Prisma } from '@prisma/client';
import { Inspiration } from '../../../../domain/inspiration/inspiration.entity';

export class InspirationMapper {
  static toDomain(raw: PrismaInspiration): Inspiration {
    return Inspiration.reconstitute({
      id: raw.id,
      quoteVi: raw.quoteVi,
      quoteEn: raw.quoteEn,
      author: raw.author,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  static toPrismaCreate(entity: Inspiration): Prisma.InspirationCreateInput {
    return {
      id: entity.id,
      quoteVi: entity.quoteVi,
      quoteEn: entity.quoteEn,
      author: entity.author,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  static toPrismaUpdate(entity: Inspiration): Prisma.InspirationUpdateInput {
    return {
      quoteVi: entity.quoteVi,
      quoteEn: entity.quoteEn,
      author: entity.author,
      updatedAt: entity.updatedAt,
    };
  }
}
