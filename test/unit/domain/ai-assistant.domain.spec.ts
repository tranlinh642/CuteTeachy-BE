import {
  AiChatMessage,
} from '../../../src/domain/ai-assistant/ai-chat-message.entity';
import {
  AiAssistantValidationError,
  AiDraftAlreadyAppliedError,
  AiMessageNotFoundError,
  AiProviderError,
  AiProviderNotConfiguredError,
} from '../../../src/domain/ai-assistant/ai-assistant.errors';
import {
  STANDARD_PERIOD_TIMES,
  getStandardPeriodTime,
} from '../../../src/domain/ai-assistant/standard-period-times';
import {
  MAX_AI_IMAGE_SIZE_BYTES,
  validateAiChatImage,
} from '../../../src/domain/ai-assistant/ai-image.validator';
import { addDaysToDateString } from '../../../src/domain/timetable/timetable-date.helper';

describe('AI Assistant Domain', () => {
  const now = new Date('2026-10-29T08:00:00.000Z');
  const validId = '11111111-1111-4111-8111-111111111111';
  const accountId = '22222222-2222-4222-8222-222222222222';

  describe('STANDARD_PERIOD_TIMES', () => {
    it('defines 10 standard periods (Morning 1..5, Afternoon 1/6..5/10)', () => {
      expect(STANDARD_PERIOD_TIMES).toHaveLength(10);
      expect(getStandardPeriodTime(1)).toEqual({
        period: 1,
        session: 'morning',
        periodInSession: 1,
        startTime: '07:00',
        endTime: '07:45',
      });
      expect(getStandardPeriodTime(5)).toEqual({
        period: 5,
        session: 'morning',
        periodInSession: 5,
        startTime: '10:30',
        endTime: '11:15',
      });
      expect(getStandardPeriodTime(6)).toEqual({
        period: 6,
        session: 'afternoon',
        periodInSession: 1,
        startTime: '13:30',
        endTime: '14:15',
      });
      expect(getStandardPeriodTime(10)).toEqual({
        period: 10,
        session: 'afternoon',
        periodInSession: 5,
        startTime: '17:00',
        endTime: '17:45',
      });
    });
  });

  describe('validateAiChatImage', () => {
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const validWebp = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);

    it('accepts valid JPEG, PNG, and WebP up to 5MB', () => {
      expect(validateAiChatImage(validJpeg, validJpeg.length, 'image/jpeg')).toEqual({
        extension: 'jpg',
        mimeType: 'image/jpeg',
      });
      expect(validateAiChatImage(validPng, validPng.length, 'image/png')).toEqual({
        extension: 'png',
        mimeType: 'image/png',
      });
      expect(validateAiChatImage(validWebp, validWebp.length, 'image/webp')).toEqual({
        extension: 'webp',
        mimeType: 'image/webp',
      });
    });

    it('throws AiAssistantValidationError when image exceeds 5MB', () => {
      expect(() =>
        validateAiChatImage(validJpeg, MAX_AI_IMAGE_SIZE_BYTES + 1, 'image/jpeg'),
      ).toThrow(AiAssistantValidationError);
    });

    it('throws AiAssistantValidationError when magic bytes or mimeType are invalid', () => {
      const invalidBuf = Buffer.from('%PDF-1.5');
      expect(() => validateAiChatImage(invalidBuf, invalidBuf.length, 'application/pdf')).toThrow(
        AiAssistantValidationError,
      );
      expect(() => validateAiChatImage(validJpeg, validJpeg.length, 'application/pdf')).toThrow(
        AiAssistantValidationError,
      );
    });
  });

  describe('AiChatMessage entity', () => {
    it('creates user message and assistant message with draft, and marks draft applied', () => {
      const msg = AiChatMessage.create({
        id: validId,
        accountId,
        role: 'assistant',
        content: 'Đây là bản nháp thời khóa biểu của thầy/cô.',
        draft: {
          status: 'pending',
          items: [
            {
              id: 'item-1',
              kind: 'timetable_slot',
              category: 'school_teaching',
              titleOrSubject: 'Toán',
              grade: '9A',
              weekday: 2,
              startTime: '07:00',
              endTime: '07:45',
              effectiveFrom: '2026-10-29',
              tone: 'blue',
            },
          ],
        },
        now,
      });

      expect(msg.draft?.status).toBe('pending');

      msg.markDraftApplied({
        appliedAt: '2026-10-29T08:05:00.000Z',
        conflictStrategy: 'replace_conflicts',
        summary: { createdCount: 1, replacedCount: 0, skippedCount: 0 },
        items: msg.draft!.items,
      });

      expect(msg.draft?.status).toBe('applied');
      expect(msg.draft?.conflictStrategy).toBe('replace_conflicts');
      expect(msg.draft?.summary).toEqual({
        createdCount: 1,
        replacedCount: 0,
        skippedCount: 0,
      });

      expect(() =>
        msg.markDraftApplied({
          appliedAt: '2026-10-29T08:06:00.000Z',
          conflictStrategy: 'skip_conflicts',
          summary: { createdCount: 0, replacedCount: 0, skippedCount: 1 },
          items: msg.draft!.items,
        }),
      ).toThrow(AiDraftAlreadyAppliedError);
    });

    it('clears expired image while preserving content and draft', () => {
      const expiresAt = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
      const msg = AiChatMessage.create({
        id: validId,
        accountId,
        role: 'user',
        content: 'Thêm TKB từ ảnh này',
        imageUrl: 'http://localhost:9000/avatars/ai-1.jpg',
        imageKey: 'ai-chat/ai-1.jpg',
        imageExpiresAt: expiresAt,
        now,
      });

      expect(msg.isImageExpired(now)).toBe(false);
      expect(msg.isImageExpired(expiresAt)).toBe(true);

      msg.clearExpiredImage();
      expect(msg.imageUrl).toBeNull();
      expect(msg.imageKey).toBeNull();
      expect(msg.imageExpiresAt).toBeNull();
      expect(msg.content).toBe('Thêm TKB từ ảnh này');
    });
  });

  describe('Domain errors and addDaysToDateString', () => {
    it('exposes expected domain error codes', () => {
      expect(new AiAssistantValidationError('bad').code).toBe('validation_error');
      expect(new AiMessageNotFoundError().code).toBe('not_found');
      expect(new AiDraftAlreadyAppliedError().code).toBe('ai_draft_already_applied');
      expect(new AiProviderNotConfiguredError().code).toBe('ai_provider_not_configured');
      expect(new AiProviderError().code).toBe('ai_provider_error');
    });

    it('adds and subtracts days from YYYY-MM-DD strings accurately', () => {
      expect(addDaysToDateString('2026-10-29', -1)).toBe('2026-10-28');
      expect(addDaysToDateString('2026-10-29', 14)).toBe('2026-11-12');
    });
  });
});
