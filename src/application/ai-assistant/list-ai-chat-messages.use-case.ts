import { ListAiChatMessagesResult, toAiChatMessageDto } from './ai-assistant.dto';
import type { AiChatMessageRepository } from './ports/ai-chat-message.repository.port';

export interface ListAiChatMessagesInput {
  accountId: string;
  limit?: number;
}

export class ListAiChatMessagesUseCase {
  constructor(private readonly chatMessageRepo: AiChatMessageRepository) {}

  async execute(input: ListAiChatMessagesInput): Promise<ListAiChatMessagesResult> {
    const rawLimit = input.limit ?? 50;
    const limit = Math.min(Math.max(1, rawLimit), 200);
    const messages = await this.chatMessageRepo.findByAccount(input.accountId, limit);
    return {
      items: messages.map(toAiChatMessageDto),
    };
  }
}
