import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiChatMessageRepository } from '../../../../application/ai-assistant/ports/ai-chat-message.repository.port';
import { AiChatMessage } from '../../../../domain/ai-assistant/ai-chat-message.entity';
import { AiChatMessageMapper } from '../mappers/ai-chat-message.mapper';
import { PrismaService } from '../prisma.service';

export type PrismaAiChatMessageClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PrismaAiChatMessageRepository implements AiChatMessageRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaAiChatMessageClient) {}

  async findById(id: string): Promise<AiChatMessage | null> {
    const raw = await this.prisma.aiChatMessage.findUnique({
      where: { id },
    });
    return raw ? AiChatMessageMapper.toDomain(raw) : null;
  }

  async findByAccount(accountId: string, limit = 50): Promise<AiChatMessage[]> {
    const rows = await this.prisma.aiChatMessage.findMany({
      where: { accountId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.reverse().map(AiChatMessageMapper.toDomain);
  }

  async findExpiredWithImages(now: Date): Promise<AiChatMessage[]> {
    const rows = await this.prisma.aiChatMessage.findMany({
      where: {
        imageKey: { not: null },
        imageExpiresAt: { lte: now },
      },
      orderBy: { imageExpiresAt: 'asc' },
    });
    return rows.map(AiChatMessageMapper.toDomain);
  }

  async save(message: AiChatMessage): Promise<void> {
    const createData = AiChatMessageMapper.toPrismaCreate(message);
    await this.prisma.aiChatMessage.upsert({
      where: { id: message.id },
      create: createData,
      update: AiChatMessageMapper.toPrismaUpdate(message),
    });
  }

  async deleteByAccount(accountId: string): Promise<void> {
    await this.prisma.aiChatMessage.deleteMany({
      where: { accountId },
    });
  }
}
