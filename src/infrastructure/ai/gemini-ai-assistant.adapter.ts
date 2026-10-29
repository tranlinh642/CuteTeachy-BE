import { Inject, Injectable } from '@nestjs/common';
import {
  AiAssistantPort,
  GenerateAiReplyInput,
  GenerateAiReplyOutput,
} from '../../application/ai-assistant/ports/ai-assistant.port';
import {
  AiProviderError,
  AiProviderNotConfiguredError,
} from '../../domain/ai-assistant/ai-assistant.errors';
import { AiScheduleDraftItem } from '../../domain/ai-assistant/ai-schedule-draft.vo';
import { formatStandardPeriodTimesTable } from '../../domain/ai-assistant/standard-period-times';
import { APP_CONFIG, AppConfig } from '../config/app.config';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  required: ['reply'],
  properties: {
    reply: {
      type: 'STRING',
      description: 'Natural language response to the teacher in their preferred locale.',
    },
    draftItems: {
      type: 'ARRAY',
      description:
        'List of schedule or task draft items extracted from the teacher message or timetable image. Omit or return empty array when answering a read-only question.',
      items: {
        type: 'OBJECT',
        required: ['id', 'kind', 'category', 'titleOrSubject'],
        properties: {
          id: { type: 'STRING' },
          kind: {
            type: 'STRING',
            enum: ['timetable_slot', 'class_session', 'task'],
          },
          category: {
            type: 'STRING',
            enum: ['school_teaching', 'extra_teaching', 'self_study'],
          },
          titleOrSubject: { type: 'STRING' },
          grade: { type: 'STRING', nullable: true },
          room: { type: 'STRING', nullable: true },
          weekday: {
            type: 'INTEGER',
            nullable: true,
            description: '1 = Monday .. 7 = Sunday for timetable_slot',
          },
          date: {
            type: 'STRING',
            nullable: true,
            description: 'YYYY-MM-DD for class_session or task',
          },
          startTime: {
            type: 'STRING',
            nullable: true,
            description: 'HH:mm 24-hour clock time',
          },
          endTime: {
            type: 'STRING',
            nullable: true,
            description: 'HH:mm 24-hour clock time',
          },
          effectiveFrom: {
            type: 'STRING',
            nullable: true,
            description: 'YYYY-MM-DD for timetable_slot',
          },
          effectiveTo: {
            type: 'STRING',
            nullable: true,
            description: 'YYYY-MM-DD for timetable_slot',
          },
          tone: {
            type: 'STRING',
            enum: ['pink', 'blue', 'beige', 'lavender', 'rose', 'mint'],
            nullable: true,
          },
          notes: { type: 'STRING', nullable: true },
        },
      },
    },
  },
};

@Injectable()
export class GeminiAiAssistantAdapter implements AiAssistantPort {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.apiKey = (config.GEMINI_API_KEY ?? '').trim();
    this.model = (config.GEMINI_MODEL ?? 'gemini-2.5-flash').trim() || 'gemini-2.5-flash';
  }

  async generateReply(input: GenerateAiReplyInput): Promise<GenerateAiReplyOutput> {
    if (!this.apiKey) {
      throw new AiProviderNotConfiguredError();
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const systemPrompt = this.buildSystemPrompt(input);
    const parts: Record<string, unknown>[] = [];

    if (input.image) {
      parts.push({
        inlineData: {
          mimeType: input.image.mimeType,
          data: input.image.base64,
        },
      });
    }

    parts.push({
      text:
        input.message ??
        'Hãy phân tích ảnh thời khóa biểu đính kèm và tạo bản nháp lịch (draftItems) cho tôi.',
    });

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        ...(input.history ?? []).map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      throw new AiProviderError(
        `Failed to connect to Gemini API: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!response.ok) {
      let detail = '';
      try {
        detail = await response.text();
      } catch {
        // ignore
      }
      throw new AiProviderError(
        `Gemini API returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      );
    }

    let rawJson: any;
    try {
      rawJson = await response.json();
    } catch {
      throw new AiProviderError('Invalid JSON response from Gemini API');
    }

    const candidateText: string | undefined =
      rawJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText || typeof candidateText !== 'string') {
      throw new AiProviderError('Gemini API returned an empty candidate response');
    }

    let parsed: { reply?: unknown; draftItems?: unknown };
    try {
      parsed = JSON.parse(candidateText);
    } catch {
      throw new AiProviderError('Failed to parse structured JSON output from Gemini API');
    }

    const reply =
      typeof parsed.reply === 'string' && parsed.reply.trim().length > 0
        ? parsed.reply.trim()
        : 'Tôi đã xử lý yêu cầu của thầy/cô.';

    const draftItems = Array.isArray(parsed.draftItems)
      ? (parsed.draftItems as AiScheduleDraftItem[])
      : undefined;

    return {
      reply,
      draftItems,
    };
  }

  private buildSystemPrompt(input: GenerateAiReplyInput): string {
    const { context } = input;
    const periodTable = formatStandardPeriodTimesTable();

    return [
      'Bạn là Trợ lý AI thông minh dành cho giáo viên trên ứng dụng CuteTeachy (Serene Educator).',
      `Ngôn ngữ phản hồi ưu tiên: ${context.locale === 'en' ? 'English' : 'Tiếng Việt'}.`,
      `Hôm nay là: ${context.today} (weekday=${context.weekday}, 1=Thứ Hai .. 7=Chủ Nhật), múi giờ: ${context.timeZone}.`,
      '',
      '=== BẢNG QUY ĐỔI KHUNG GIỜ TIẾT HỌC TIÊU CHUẨN (1..10) ===',
      'Khi ảnh Thời khóa biểu hoặc tin nhắn chỉ ghi số tiết (Tiết 1..5 Sáng hoặc Tiết 1..5 Chiều / Tiết 6..10) mà không ghi giờ cụ thể, hãy tự động quy đổi sang startTime và endTime theo bảng sau (nếu giáo viên nêu khung giờ riêng trong tin nhắn thì ưu tiên giờ của giáo viên):',
      periodTable,
      '',
      '=== QUY TẮC PHÂN LOẠI LỊCH (category) ===',
      '- school_teaching: Lịch dạy chính khóa trên lớp tại trường (mặc định).',
      '- extra_teaching: Lịch dạy thêm, phụ đạo, bồi dưỡng bên ngoài.',
      '- self_study: Lịch học thêm, bồi dưỡng chuyên môn, học ngoại ngữ (IELTS, cao học...) của chính giáo viên.',
      '',
      '=== QUY TẮC LOẠI MỤC NHÁP (kind) ===',
      '- timetable_slot: Lịch lặp lại hàng tuần theo Thứ (weekday 1..7, startTime, endTime, effectiveFrom mặc định là hôm nay).',
      '- class_session: Buổi dạy/học lẻ vào một ngày cụ thể (date YYYY-MM-DD, startTime, endTime).',
      '- task: Công việc cần làm vào một ngày cụ thể (date YYYY-MM-DD, startTime tùy chọn).',
      '',
      `=== DỮ LIỆU HIỆN TẠI CỦA GIÁO VIÊN (${context.windowFrom} -> ${context.windowTo}) ===`,
      `1. Timetable Slots đang hoạt động: ${JSON.stringify(context.timetableSlots)}`,
      `2. Class Sessions (lịch dạy/học trong khoảng ngày): ${JSON.stringify(context.classSessions)}`,
      `3. Tasks (công việc): ${JSON.stringify(context.tasks)}`,
      `4. Notes (ghi chú): ${JSON.stringify(context.notes)}`,
    ].join('\n');
  }
}
