import { GeminiAiAssistantAdapter } from '../../../src/infrastructure/ai/gemini-ai-assistant.adapter';
import { AiChatMessageMapper } from '../../../src/infrastructure/persistence/prisma/mappers/ai-chat-message.mapper';
import {
  AiProviderError,
  AiProviderNotConfiguredError,
} from '../../../src/domain/ai-assistant/ai-assistant.errors';
import { STANDARD_PERIOD_TIMES } from '../../../src/domain/ai-assistant/standard-period-times';
import { AiChatMessage } from '../../../src/domain/ai-assistant/ai-chat-message.entity';
import type { AppConfig } from '../../../src/infrastructure/config/app.config';

describe('GeminiAiAssistantAdapter & AiChatMessageMapper', () => {
  const baseContext = {
    today: '2026-10-29',
    weekday: 4,
    timeZone: 'Asia/Ho_Chi_Minh',
    locale: 'vi',
    windowFrom: '2026-10-22',
    windowTo: '2026-11-12',
    standardPeriodTimes: STANDARD_PERIOD_TIMES,
    timetableSlots: [],
    classSessions: [],
    tasks: [],
    notes: [],
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws AiProviderNotConfiguredError (503) when GEMINI_API_KEY is not configured', async () => {
    const adapter = new GeminiAiAssistantAdapter({
      GEMINI_API_KEY: '',
      GEMINI_MODEL: 'gemini-2.5-flash',
    } as AppConfig);

    await expect(
      adapter.generateReply({
        message: 'Hôm nay tôi có lịch gì?',
        context: baseContext,
      }),
    ).rejects.toThrow(AiProviderNotConfiguredError);
  });

  it('calls Gemini REST generateContent endpoint with responseSchema and inlineData for multimodal input', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    reply: 'Tôi đã bóc tách Tiết 1 Sáng Thứ 2 thành 07:00-07:45.',
                    draftItems: [
                      {
                        id: 'item-1',
                        kind: 'timetable_slot',
                        category: 'school_teaching',
                        titleOrSubject: 'Toán 9A',
                        grade: '9A',
                        room: 'P.101',
                        weekday: 1,
                        startTime: '07:00',
                        endTime: '07:45',
                        effectiveFrom: '2026-10-29',
                        tone: 'blue',
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    } as unknown as Response);

    const adapter = new GeminiAiAssistantAdapter({
      GEMINI_API_KEY: 'test-gemini-key',
      GEMINI_MODEL: 'gemini-2.5-flash',
    } as AppConfig);

    const output = await adapter.generateReply({
      message: 'Bóc tách ảnh TKB',
      image: {
        base64: 'dGVzdA==',
        mimeType: 'image/jpeg',
      },
      context: baseContext,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
    const body = JSON.parse(String(init?.body));
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toBeDefined();
    expect(body.generationConfig.maxOutputTokens).toBe(16384);
    expect(
      body.generationConfig.responseSchema.properties.draftItems.items.properties.action.enum,
    ).toEqual(['create', 'update', 'delete', 'cancel']);
    const sysInstruction = body.systemInstruction?.parts?.[0]?.text ?? '';
    expect(sysInstruction).toContain('LLM GUARDRAILS');
    expect(sysInstruction).toContain('Phân quyền & Cô lập dữ liệu');
    expect(sysInstruction).toContain('Giới hạn phạm vi nghiệp vụ');
    expect(sysInstruction).toContain('Anti-Prompt Injection');

    expect(output.reply).toContain('07:00-07:45');
    expect(output.draftItems).toHaveLength(1);
    expect(output.draftItems?.[0].titleOrSubject).toBe('Toán 9A');
  });

  it('ignores thought parts and extracts final JSON text part from Gemini thinking responses', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: 'Internal chain of thought...' },
                {
                  text: JSON.stringify({
                    reply: 'Đã hủy tiết 1 Thứ 4 tuần này.',
                    draftItems: [
                      {
                        id: 'cancel-1',
                        kind: 'class_session',
                        action: 'cancel',
                        targetSessionId: 'slot-1:2026-10-29',
                        category: 'school_teaching',
                        titleOrSubject: 'Toán 8A13',
                        date: '2026-10-29',
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    } as unknown as Response);

    const adapter = new GeminiAiAssistantAdapter({
      GEMINI_API_KEY: 'test-gemini-key',
      GEMINI_MODEL: 'gemini-2.5-flash',
    } as AppConfig);

    const output = await adapter.generateReply({
      message: 'Nghỉ tiết 1 hôm nay',
      context: baseContext,
    });

    expect(output.reply).toBe('Đã hủy tiết 1 Thứ 4 tuần này.');
    expect(output.draftItems?.[0]?.action).toBe('cancel');
  });

  it('throws AiProviderError when Gemini upstream returns non-OK HTTP status', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'Bad Gateway',
    } as unknown as Response);

    const adapter = new GeminiAiAssistantAdapter({
      GEMINI_API_KEY: 'test-gemini-key',
      GEMINI_MODEL: 'gemini-2.5-flash',
    } as AppConfig);

    await expect(
      adapter.generateReply({
        message: 'Xin chào',
        context: baseContext,
      }),
    ).rejects.toThrow(AiProviderError);
  });

  it('maps AiChatMessage between Prisma row and Domain entity accurately', () => {
    const now = new Date('2026-10-29T08:00:00.000Z');
    const entity = AiChatMessage.create({
      id: '11111111-1111-4111-8111-111111111111',
      accountId: '22222222-2222-4222-8222-222222222222',
      role: 'assistant',
      content: 'Bản nháp',
      draft: {
        status: 'pending',
        items: [
          {
            id: 'item-1',
            kind: 'timetable_slot',
            category: 'extra_teaching',
            titleOrSubject: 'Toán 9A',
            weekday: 2,
            startTime: '18:00',
            endTime: '19:30',
            tone: 'lavender',
          },
        ],
      },
      now,
    });

    const prismaCreate = AiChatMessageMapper.toPrismaCreate(entity);
    const roundTrip = AiChatMessageMapper.toDomain({
      id: prismaCreate.id,
      accountId: prismaCreate.accountId,
      role: prismaCreate.role,
      content: prismaCreate.content,
      imageUrl: prismaCreate.imageUrl,
      imageKey: prismaCreate.imageKey,
      imageExpiresAt: prismaCreate.imageExpiresAt,
      draft: prismaCreate.draft as any,
      createdAt: prismaCreate.createdAt,
    });

    expect(roundTrip.id).toBe(entity.id);
    expect(roundTrip.draft?.items[0].category).toBe('extra_teaching');
  });
});
