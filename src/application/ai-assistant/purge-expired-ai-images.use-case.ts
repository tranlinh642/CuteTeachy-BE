import type { ObjectStorage } from '../avatar/ports/object-storage.port';
import type { Clock } from '../shared/ports/clock.port';
import type { AiChatMessageRepository } from './ports/ai-chat-message.repository.port';

export interface PurgeExpiredAiImagesOutput {
  purgedCount: number;
}

export class PurgeExpiredAiImagesUseCase {
  constructor(
    private readonly chatMessageRepo: AiChatMessageRepository,
    private readonly storage: ObjectStorage,
    private readonly clock: Clock,
    private readonly bucket = 'avatars',
  ) {}

  async execute(): Promise<PurgeExpiredAiImagesOutput> {
    const now = this.clock.now();
    const expiredMessages = await this.chatMessageRepo.findExpiredWithImages(now);
    let purgedCount = 0;

    for (const msg of expiredMessages) {
      if (!msg.imageKey) {
        continue;
      }

      try {
        await this.storage.deleteObject(this.bucket, msg.imageKey);
      } catch {
        // Proceed with clearing DB metadata even if storage object was already removed
      }

      msg.clearExpiredImage();
      await this.chatMessageRepo.save(msg);
      purgedCount++;
    }

    return { purgedCount };
  }
}
