import { AiChatMessageRepository } from '../../src/application/ai-assistant/ports/ai-chat-message.repository.port';
import { AiChatMessage } from '../../src/domain/ai-assistant/ai-chat-message.entity';

export class InMemoryAiChatMessageRepository implements AiChatMessageRepository {
  private messages = new Map<string, AiChatMessage>();

  async findById(id: string): Promise<AiChatMessage | null> {
    const msg = this.messages.get(id);
    return msg ? this.clone(msg) : null;
  }

  async findByAccount(accountId: string, limit = 50): Promise<AiChatMessage[]> {
    const items = Array.from(this.messages.values())
      .filter((m) => m.accountId === accountId)
      .sort((a, b) => {
        const diff = a.createdAt.getTime() - b.createdAt.getTime();
        if (diff !== 0) return diff;
        if (a.role === b.role) return a.id.localeCompare(b.id);
        return a.role === 'user' ? -1 : 1;
      });
    const sliced = items.slice(-limit);
    return sliced.map((m) => this.clone(m));
  }

  async findExpiredWithImages(now: Date): Promise<AiChatMessage[]> {
    return Array.from(this.messages.values())
      .filter((m) => m.isImageExpired(now))
      .map((m) => this.clone(m));
  }

  async save(message: AiChatMessage): Promise<void> {
    this.messages.set(message.id, this.clone(message));
  }

  async deleteByAccount(accountId: string): Promise<void> {
    for (const [id, msg] of this.messages.entries()) {
      if (msg.accountId === accountId) {
        this.messages.delete(id);
      }
    }
  }

  getAll(): AiChatMessage[] {
    return Array.from(this.messages.values()).map((m) => this.clone(m));
  }

  snapshot(): Map<string, AiChatMessage> {
    const snap = new Map<string, AiChatMessage>();
    for (const [k, v] of this.messages.entries()) {
      snap.set(k, this.clone(v));
    }
    return snap;
  }

  restore(snap: Map<string, AiChatMessage>): void {
    this.messages = new Map<string, AiChatMessage>();
    for (const [k, v] of snap.entries()) {
      this.messages.set(k, this.clone(v));
    }
  }

  clear(): void {
    this.messages.clear();
  }

  private clone(msg: AiChatMessage): AiChatMessage {
    return AiChatMessage.reconstitute({
      id: msg.id,
      accountId: msg.accountId,
      role: msg.role,
      content: msg.content,
      imageUrl: msg.imageUrl,
      imageKey: msg.imageKey,
      imageExpiresAt: msg.imageExpiresAt ? new Date(msg.imageExpiresAt.getTime()) : null,
      draft: msg.draft ? JSON.parse(JSON.stringify(msg.draft)) : null,
      createdAt: new Date(msg.createdAt.getTime()),
    });
  }
}
