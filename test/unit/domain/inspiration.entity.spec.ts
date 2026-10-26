import { Inspiration } from '../../../src/domain/inspiration/inspiration.entity';
import { InspirationValidationError } from '../../../src/domain/inspiration/inspiration.errors';

describe('Inspiration Entity', () => {
  it('creates a valid inspiration entity', () => {
    const now = new Date('2026-10-26T12:00:00Z');
    const inspiration = Inspiration.create({
      id: 'insp-1',
      quoteVi: 'Ảnh hưởng của một người thầy tốt không bao giờ phai nhạt.',
      quoteEn: 'The influence of a good teacher can never be erased.',
      author: 'Unknown',
      now,
    });

    expect(inspiration.id).toBe('insp-1');
    expect(inspiration.quoteVi).toBe('Ảnh hưởng của một người thầy tốt không bao giờ phai nhạt.');
    expect(inspiration.quoteEn).toBe('The influence of a good teacher can never be erased.');
    expect(inspiration.author).toBe('Unknown');
    expect(inspiration.quote).toEqual({
      vi: 'Ảnh hưởng của một người thầy tốt không bao giờ phai nhạt.',
      en: 'The influence of a good teacher can never be erased.',
    });
    expect(inspiration.createdAt).toEqual(now);
    expect(inspiration.updatedAt).toEqual(now);
  });

  it('sets author to null when author is omitted or null', () => {
    const inspiration = Inspiration.create({
      id: 'insp-2',
      quoteVi: 'Dạy học là gieo hạt giống cho ngày mai.',
      quoteEn: 'To teach is to touch a life forever.',
    });

    expect(inspiration.author).toBeNull();
  });

  it('throws validation error when id is missing or empty', () => {
    expect(() =>
      Inspiration.create({
        id: '',
        quoteVi: 'Vi',
        quoteEn: 'En',
      }),
    ).toThrow(InspirationValidationError);
  });

  it('throws validation error when quoteVi is missing or empty', () => {
    expect(() =>
      Inspiration.create({
        id: 'insp-1',
        quoteVi: '  ',
        quoteEn: 'En',
      }),
    ).toThrow(InspirationValidationError);
  });

  it('throws validation error when quoteEn is missing or empty', () => {
    expect(() =>
      Inspiration.create({
        id: 'insp-1',
        quoteVi: 'Vi',
        quoteEn: '',
      }),
    ).toThrow(InspirationValidationError);
  });

  it('reconstitutes an inspiration entity from props', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const updatedAt = new Date('2026-02-01T00:00:00Z');
    const inspiration = Inspiration.reconstitute({
      id: 'insp-3',
      quoteVi: 'Mỗi ngày là một cơ hội mới để truyền cảm hứng.',
      quoteEn: 'Every day is a new chance to inspire.',
      author: 'Author Name',
      createdAt,
      updatedAt,
    });

    expect(inspiration.id).toBe('insp-3');
    expect(inspiration.quoteVi).toBe('Mỗi ngày là một cơ hội mới để truyền cảm hứng.');
    expect(inspiration.quoteEn).toBe('Every day is a new chance to inspire.');
    expect(inspiration.author).toBe('Author Name');
    expect(inspiration.createdAt).toEqual(createdAt);
    expect(inspiration.updatedAt).toEqual(updatedAt);
  });
});
