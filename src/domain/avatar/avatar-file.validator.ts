import { FileTooLargeError, UnsupportedFileTypeError } from './avatar.errors';

export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export interface DetectedImageFormat {
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
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46; // F

  const isWebpSignature =
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50; // P

  return isRiff && isWebpSignature;
}

export function validateAvatarFile(buffer: Buffer, reportedSize: number): DetectedImageFormat {
  if (reportedSize > MAX_AVATAR_SIZE_BYTES || buffer.length > MAX_AVATAR_SIZE_BYTES) {
    throw new FileTooLargeError();
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

  throw new UnsupportedFileTypeError();
}
