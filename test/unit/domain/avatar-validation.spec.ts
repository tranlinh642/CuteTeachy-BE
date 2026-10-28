import {
  validateAvatarFile,
  DetectedImageFormat,
} from '../../../src/domain/avatar/avatar-file.validator';
import {
  FileTooLargeError,
  UnsupportedFileTypeError,
} from '../../../src/domain/avatar/avatar.errors';

describe('AvatarFileValidator', () => {
  const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

  // Sample valid magic byte buffers
  const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  const validWebp = Buffer.concat([
    Buffer.from([0x52, 0x49, 0x46, 0x46]), // 'RIFF'
    Buffer.from([0x24, 0x00, 0x00, 0x00]), // file size
    Buffer.from([0x57, 0x45, 0x42, 0x50]), // 'WEBP'
    Buffer.from([0x56, 0x50, 0x38, 0x20]), // 'VP8 '
  ]);

  it('accepts valid JPEG buffer and returns jpg extension and image/jpeg mimeType', () => {
    const result = validateAvatarFile(validJpeg, validJpeg.length);
    expect(result).toEqual<DetectedImageFormat>({
      extension: 'jpg',
      mimeType: 'image/jpeg',
    });
  });

  it('accepts valid PNG buffer and returns png extension and image/png mimeType', () => {
    const result = validateAvatarFile(validPng, validPng.length);
    expect(result).toEqual<DetectedImageFormat>({
      extension: 'png',
      mimeType: 'image/png',
    });
  });

  it('accepts valid WebP buffer and returns webp extension and image/webp mimeType', () => {
    const result = validateAvatarFile(validWebp, validWebp.length);
    expect(result).toEqual<DetectedImageFormat>({
      extension: 'webp',
      mimeType: 'image/webp',
    });
  });

  it('throws FileTooLargeError when file size exceeds 2 MB', () => {
    const oversized = MAX_SIZE + 1;
    expect(() => validateAvatarFile(validJpeg, oversized)).toThrow(FileTooLargeError);
  });

  it('throws FileTooLargeError when buffer length exceeds 2 MB even if reported size is small', () => {
    const hugeBuffer = Buffer.alloc(MAX_SIZE + 10);
    // Copy valid JPEG magic bytes to the start
    validJpeg.copy(hugeBuffer, 0);

    expect(() => validateAvatarFile(hugeBuffer, 100)).toThrow(FileTooLargeError);
  });

  it('throws UnsupportedFileTypeError for unsupported file types (GIF, PDF, text)', () => {
    const gifBuffer = Buffer.from('GIF89a...');
    const pdfBuffer = Buffer.from('%PDF-1.4...');
    const textBuffer = Buffer.from('hello world not an image');

    expect(() => validateAvatarFile(gifBuffer, gifBuffer.length)).toThrow(UnsupportedFileTypeError);
    expect(() => validateAvatarFile(pdfBuffer, pdfBuffer.length)).toThrow(UnsupportedFileTypeError);
    expect(() => validateAvatarFile(textBuffer, textBuffer.length)).toThrow(
      UnsupportedFileTypeError,
    );
  });

  it('throws UnsupportedFileTypeError for short buffers (< 12 bytes)', () => {
    const shortBuffer = Buffer.from([0xff, 0xd8]);
    expect(() => validateAvatarFile(shortBuffer, shortBuffer.length)).toThrow(
      UnsupportedFileTypeError,
    );
  });
});
