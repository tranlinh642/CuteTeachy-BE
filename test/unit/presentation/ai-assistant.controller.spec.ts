import { AiAssistantController } from '../../../src/presentation/http/ai-assistant/ai-assistant.controller';
import { SendAiMessageUseCase } from '../../../src/application/ai-assistant/send-ai-message.use-case';
import { ApplyAiScheduleDraftUseCase } from '../../../src/application/ai-assistant/apply-ai-schedule-draft.use-case';
import { ListAiChatMessagesUseCase } from '../../../src/application/ai-assistant/list-ai-chat-messages.use-case';
import { ClearAiChatHistoryUseCase } from '../../../src/application/ai-assistant/clear-ai-chat-history.use-case';
import type { AccessTokenPayload } from '../../../src/application/account/ports/token.service.port';

describe('AiAssistantController', () => {
  const user: AccessTokenPayload = {
    sub: '11111111-1111-4111-8111-111111111111',
  };

  let sendUseCase: { execute: jest.Mock };
  let applyUseCase: { execute: jest.Mock };
  let listUseCase: { execute: jest.Mock };
  let clearUseCase: { execute: jest.Mock };
  let controller: AiAssistantController;

  beforeEach(() => {
    sendUseCase = { execute: jest.fn() };
    applyUseCase = { execute: jest.fn() };
    listUseCase = { execute: jest.fn() };
    clearUseCase = { execute: jest.fn() };

    controller = new AiAssistantController(
      sendUseCase as unknown as SendAiMessageUseCase,
      applyUseCase as unknown as ApplyAiScheduleDraftUseCase,
      listUseCase as unknown as ListAiChatMessagesUseCase,
      clearUseCase as unknown as ClearAiChatHistoryUseCase,
    );
  });

  it('lists chat messages for current user', async () => {
    listUseCase.execute.mockResolvedValue({ items: [] });
    const res = await controller.listMessages(user, { limit: 25 });
    expect(res).toEqual({ items: [] });
    expect(listUseCase.execute).toHaveBeenCalledWith({
      accountId: user.sub,
      limit: 25,
    });
  });

  it('sends text and optional uploaded file to SendAiMessageUseCase', async () => {
    const mockFile = {
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      size: 3,
      mimetype: 'image/jpeg',
    } as Express.Multer.File;
    sendUseCase.execute.mockResolvedValue({
      userMessage: { id: 'u1' },
      assistantMessage: { id: 'a1' },
    });

    const res = await controller.sendMessage(
      user,
      { message: 'Thêm TKB' },
      mockFile,
    );

    expect(res).toEqual({
      userMessage: { id: 'u1' },
      assistantMessage: { id: 'a1' },
    });
    expect(sendUseCase.execute).toHaveBeenCalledWith({
      accountId: user.sub,
      message: 'Thêm TKB',
      image: {
        buffer: mockFile.buffer,
        size: mockFile.size,
        mimeType: mockFile.mimetype,
      },
    });
  });

  it('applies draft via ApplyAiScheduleDraftUseCase', async () => {
    applyUseCase.execute.mockResolvedValue({
      message: { id: 'a1' },
      summary: { createdCount: 1, replacedCount: 0, skippedCount: 0 },
    });

    const res = await controller.applyDraft(user, 'msg-1', {
      conflictStrategy: 'replace_conflicts',
    });

    expect(res.summary.createdCount).toBe(1);
    expect(applyUseCase.execute).toHaveBeenCalledWith({
      accountId: user.sub,
      messageId: 'msg-1',
      conflictStrategy: 'replace_conflicts',
      items: undefined,
    });
  });

  it('clears history via ClearAiChatHistoryUseCase', async () => {
    clearUseCase.execute.mockResolvedValue(undefined);
    await controller.clearHistory(user);
    expect(clearUseCase.execute).toHaveBeenCalledWith({
      accountId: user.sub,
    });
  });
});
