import { Injectable } from '@nestjs/common';
import type { InspirationRepository } from '../../../../application/inspiration/ports/inspiration.repository.port';
import { Inspiration } from '../../../../domain/inspiration/inspiration.entity';
import { PrismaService } from '../prisma.service';
import { InspirationMapper } from '../mappers/inspiration.mapper';

@Injectable()
export class PrismaInspirationRepository implements InspirationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Inspiration[]> {
    const rows = await this.prisma.inspiration.findMany({
      orderBy: { id: 'asc' },
    });
    return rows.map((row) => InspirationMapper.toDomain(row));
  }

  async findById(id: string): Promise<Inspiration | null> {
    const raw = await this.prisma.inspiration.findUnique({
      where: { id },
    });
    return raw ? InspirationMapper.toDomain(raw) : null;
  }

  async save(inspiration: Inspiration): Promise<void> {
    const createData = InspirationMapper.toPrismaCreate(inspiration);
    const updateData = InspirationMapper.toPrismaUpdate(inspiration);

    await this.prisma.inspiration.upsert({
      where: { id: inspiration.id },
      create: createData,
      update: updateData,
    });
  }
}
