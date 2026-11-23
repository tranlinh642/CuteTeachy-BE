import { AiChatMessage } from '../../../domain/ai-assistant/ai-chat-message.entity';

export const AI_CHAT_MESSAGE_REPOSITORY = Symbol('AI_CHAT_MESSAGE_REPOSITORY');

export interface AiChatMessageRepository {
  findById(id: string): Promise<AiChatMessage | null>;
  findByAccount(accountId: string, limit?: number): Promise<AiChatMessage[]>;
  findExpiredWithImages(now: Date): Promise<AiChatMessage[]>;
  save(message: AiChatMessage): Promise<void>;
  deleteByAccount(accountId: string): Promise<void>;
}
