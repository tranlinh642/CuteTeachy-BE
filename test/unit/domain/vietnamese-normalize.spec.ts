import { normalizeVietnamese } from '../../../src/domain/note/vietnamese-normalize';

describe('normalizeVietnamese', () => {
  it('strips Vietnamese diacritics', () => {
    expect(normalizeVietnamese('Ôn tập')).toBe('on tap');
    expect(normalizeVietnamese('Toán học')).toBe('toan hoc');
    expect(normalizeVietnamese('Tiếng Việt')).toBe('tieng viet');
  });

  it('normalizes đ and Đ to d', () => {
    expect(normalizeVietnamese('đánh dấu')).toBe('danh dau');
    expect(normalizeVietnamese('ĐỒNG BỘ')).toBe('dong bo');
    expect(normalizeVietnamese('Điểm số')).toBe('diem so');
  });

  it('converts to lowercase and trims whitespace', () => {
    expect(normalizeVietnamese('  KHOA HỌC TỰ NHIÊN  ')).toBe('khoa hoc tu nhien');
  });

  it('handles empty or blank string', () => {
    expect(normalizeVietnamese('')).toBe('');
    expect(normalizeVietnamese('   ')).toBe('');
  });

  it('preserves numbers and basic punctuation', () => {
    expect(normalizeVietnamese('Lớp 12A1: Đạt 10/10')).toBe('lop 12a1: dat 10/10');
  });

  it('handles all Vietnamese vowels with tones', () => {
    const input = 'à á ả ã ạ â ầ ấ ẩ ẫ ậ ă ằ ắ ẳ ẵ ặ è é ẻ ẽ ẹ ê ề ế ể ễ ệ ì í ỉ ĩ ị ò ó ỏ õ ọ ô ồ ố ổ ỗ ộ ơ ờ ớ ở ỡ ợ ù ú ủ ũ ụ ư ừ ứ ử ữ ự ỳ ý ỷ ỹ ỵ';
    const expected = 'a a a a a a a a a a a a a a a a a e e e e e e e e e e e i i i i i o o o o o o o o o o o o o o o o o u u u u u u u u u u u y y y y y';
    expect(normalizeVietnamese(input)).toBe(expected);
  });
});
