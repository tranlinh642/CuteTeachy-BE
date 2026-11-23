import type { ObjectStorage } from '../avatar/ports/object-storage.port';
import type { AiChatMessageRepository } from './ports/ai-chat-message.repository.port';

export interface ClearAiChatHistoryInput {
  accountId: string;
}

export class ClearAiChatHistoryUseCase {
  constructor(
    private readonly chatMessageRepo: AiChatMessageRepository,
    private readonly storage: ObjectStorage,
    private readonly bucket = 'avatars',
  ) {}

  async execute(input: ClearAiChatHistoryInput): Promise<void> {
    const messages = await this.chatMessageRepo.findByAccount(input.accountId, 1000);
    for (const msg of messages) {
      if (msg.imageKey) {
        try {
          await this.storage.deleteObject(this.bucket, msg.imageKey);
        } catch {
          // Ignore storage delete errors during history cleanup
        }
      }
    }

    await this.chatMessageRepo.deleteByAccount(input.accountId);
  }
}
