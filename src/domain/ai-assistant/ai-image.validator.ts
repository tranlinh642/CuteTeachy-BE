import { AiAssistantValidationError } from './ai-assistant.errors';

export const MAX_AI_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const AI_IMAGE_RETENTION_DAYS = 45;
export const AI_IMAGE_RETENTION_MS = AI_IMAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export interface ValidatedAiImage {
  extension: 'jpg' | 'png' | 'webp';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function isWebp(buffer: Buffer): boolean {
  if (buffer.length < 12) {
    return false;
  }
  const isRiff =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46;

  const isWebpSignature =
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  return isRiff && isWebpSignature;
}

const ALLOWED_REPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export function validateAiChatImage(
  buffer: Buffer,
  reportedSize: number,
  reportedMimeType?: string,
): ValidatedAiImage {
  if (!buffer || buffer.length === 0) {
    throw new AiAssistantValidationError('Image file cannot be empty');
  }

  if (reportedSize > MAX_AI_IMAGE_SIZE_BYTES || buffer.length > MAX_AI_IMAGE_SIZE_BYTES) {
    throw new AiAssistantValidationError('Image size exceeds 5 MB limit');
  }

  if (reportedMimeType !== undefined && reportedMimeType.trim() !== '') {
    const normalizedMime = reportedMimeType.trim().toLowerCase();
    if (!ALLOWED_REPORTED_MIME_TYPES.has(normalizedMime)) {
      throw new AiAssistantValidationError('Image format must be JPEG, PNG, or WebP');
    }
  }

  if (isJpeg(buffer)) {
    return {
      extension: 'jpg',
      mimeType: 'image/jpeg',
    };
  }

  if (isPng(buffer)) {
    return {
      extension: 'png',
      mimeType: 'image/png',
    };
  }

  if (isWebp(buffer)) {
    return {
      extension: 'webp',
      mimeType: 'image/webp',
    };
  }

  throw new AiAssistantValidationError('Image format must be JPEG, PNG, or WebP');
}
