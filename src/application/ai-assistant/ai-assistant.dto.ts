import { AiChatMessage } from '../../domain/ai-assistant/ai-chat-message.entity';
import {
  AiScheduleDraft,
  AiScheduleDraftSummary,
} from '../../domain/ai-assistant/ai-schedule-draft.vo';

export interface AiChatMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string | null;
  imageExpiresAt?: string | null;
  draft?: AiScheduleDraft | null;
  createdAt: string;
}

export interface SendAiMessageResult {
  userMessage: AiChatMessageDto;
  assistantMessage: AiChatMessageDto;
}

export interface ApplyAiScheduleDraftResult {
  message: AiChatMessageDto;
  summary: AiScheduleDraftSummary;
}

export interface ListAiChatMessagesResult {
  items: AiChatMessageDto[];
}

export function toAiChatMessageDto(msg: AiChatMessage): AiChatMessageDto {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    imageUrl: msg.imageUrl,
    imageExpiresAt: msg.imageExpiresAt ? msg.imageExpiresAt.toISOString() : null,
    draft: msg.draft,
    createdAt: msg.createdAt.toISOString(),
  };
}
