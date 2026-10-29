import {
  AiAssistantPort,
  GenerateAiReplyInput,
  GenerateAiReplyOutput,
} from '../../src/application/ai-assistant/ports/ai-assistant.port';

export class FakeAiAssistant implements AiAssistantPort {
  public readonly calls: GenerateAiReplyInput[] = [];
  private nextReply: GenerateAiReplyOutput = {
    reply: 'Xin chào thầy/cô! Tôi có thể giúp gì cho lịch trình hôm nay?',
  };
  private handler: ((input: GenerateAiReplyInput) => Promise<GenerateAiReplyOutput> | GenerateAiReplyOutput) | null =
    null;

  setNextReply(output: GenerateAiReplyOutput): void {
    this.nextReply = output;
    this.handler = null;
  }

  setHandler(
    fn: (input: GenerateAiReplyInput) => Promise<GenerateAiReplyOutput> | GenerateAiReplyOutput,
  ): void {
    this.handler = fn;
  }

  async generateReply(input: GenerateAiReplyInput): Promise<GenerateAiReplyOutput> {
    this.calls.push(input);
    if (this.handler) {
      return this.handler(input);
    }
    return {
      reply: this.nextReply.reply,
      draftItems: this.nextReply.draftItems
        ? this.nextReply.draftItems.map((item) => ({ ...item }))
        : undefined,
    };
  }

  clear(): void {
    this.calls.length = 0;
    this.handler = null;
  }
}
