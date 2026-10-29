import { AiChatMessage as PrismaAiChatMessage, Prisma } from '@prisma/client';
import {
  AiChatMessage,
  AiChatRole,
} from '../../../../domain/ai-assistant/ai-chat-message.entity';
import { AiScheduleDraft } from '../../../../domain/ai-assistant/ai-schedule-draft.vo';

export class AiChatMessageMapper {
  public static toDomain(raw: PrismaAiChatMessage): AiChatMessage {
    return AiChatMessage.reconstitute({
      id: raw.id,
      accountId: raw.accountId,
      role: raw.role as AiChatRole,
      content: raw.content,
      imageUrl: raw.imageUrl,
      imageKey: raw.imageKey,
      imageExpiresAt: raw.imageExpiresAt,
      draft: (raw.draft as unknown as AiScheduleDraft) ?? null,
      createdAt: raw.createdAt,
    });
  }

  public static toPrismaCreate(entity: AiChatMessage) {
    return {
      id: entity.id,
      accountId: entity.accountId,
      role: entity.role,
      content: entity.content,
      imageUrl: entity.imageUrl,
      imageKey: entity.imageKey,
      imageExpiresAt: entity.imageExpiresAt,
      draft:
        entity.draft !== null
          ? (entity.draft as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      createdAt: entity.createdAt,
    };
  }

  public static toPrismaUpdate(entity: AiChatMessage) {
    return {
      content: entity.content,
      imageUrl: entity.imageUrl,
      imageKey: entity.imageKey,
      imageExpiresAt: entity.imageExpiresAt,
      draft:
        entity.draft !== null
          ? (entity.draft as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    };
  }
}
