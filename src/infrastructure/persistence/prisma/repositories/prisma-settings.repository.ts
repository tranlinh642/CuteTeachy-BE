import { Injectable } from '@nestjs/common';
import { SettingsRepository } from '../../../../application/settings/ports/settings.repository.port';
import { TeacherSettingsReader } from '../../../../application/settings/ports/teacher-settings.port';
import { Settings } from '../../../../domain/settings/settings.entity';
import { PrismaService } from '../prisma.service';
import { SettingsMapper } from '../mappers/settings.mapper';

@Injectable()
export class PrismaSettingsRepository implements SettingsRepository, TeacherSettingsReader {
  constructor(private readonly prisma: PrismaService) {}

  async findByAccountId(accountId: string): Promise<Settings | null> {
    const raw = await this.prisma.settings.findUnique({
      where: { accountId },
    });
    return raw ? SettingsMapper.toDomain(raw) : null;
  }

  async getSettings(accountId: string): Promise<Settings | null> {
    return this.findByAccountId(accountId);
  }

  async findPushEnabledTeachers(): Promise<Settings[]> {
    const rawList = await this.prisma.settings.findMany({
      where: { pushEnabled: true },
    });
    return rawList.map((raw) => SettingsMapper.toDomain(raw));
  }

  async save(settings: Settings): Promise<void> {
    const createData = SettingsMapper.toPrismaCreate(settings);
    const updateData = SettingsMapper.toPrismaUpdate(settings);

    await this.prisma.settings.upsert({
      where: { accountId: settings.accountId },
      create: createData,
      update: updateData,
    });
  }
}
