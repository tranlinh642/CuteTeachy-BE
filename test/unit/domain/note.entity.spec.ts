import { Note } from '../../../src/domain/note/note.entity';
import { NoteValidationError } from '../../../src/domain/note/note.errors';

describe('Note Entity', () => {
  const validId = '11111111-1111-4111-8111-111111111111';
  const validAccountId = 'acc-123';
  const now = new Date('2026-10-26T12:00:00.000Z');

  describe('create - validation', () => {
    it('creates a minimal valid note with empty checklist and default completed=false', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'Ghi chú họp chuyên môn',
        now,
      });

      expect(note.id).toBe(validId);
      expect(note.accountId).toBe(validAccountId);
      expect(note.title).toBe('Ghi chú họp chuyên môn');
      expect(note.content).toBeNull();
      expect(note.checklist).toEqual([]);
      expect(note.tagIds).toEqual([]);
      expect(note.dueDate).toBeNull();
      expect(note.completed).toBe(false);
      expect(note.createdAt).toEqual(now);
      expect(note.updatedAt).toEqual(now);
      expect(note.deletedAt).toBeNull();
      expect(note.isDeleted()).toBe(false);
    });

    it('trims title whitespace', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: '   Tiêu đề có khoảng trắng   ',
        now,
      });
      expect(note.title).toBe('Tiêu đề có khoảng trắng');
    });

    it('throws when id is not a valid UUID', () => {
      expect(() =>
        Note.create({
          id: 'invalid-uuid',
          accountId: validAccountId,
          title: 'Tiêu đề',
          now,
        }),
      ).toThrow(NoteValidationError);
    });

    it('throws when title is empty or only whitespace', () => {
      expect(() =>
        Note.create({
          id: validId,
          accountId: validAccountId,
          title: '   ',
          now,
        }),
      ).toThrow(NoteValidationError);
    });

    it('throws when title exceeds 120 characters', () => {
      expect(() =>
        Note.create({
          id: validId,
          accountId: validAccountId,
          title: 'a'.repeat(121),
          now,
        }),
      ).toThrow(NoteValidationError);
    });

    it('accepts title up to 120 characters', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'a'.repeat(120),
        now,
      });
      expect(note.title).toHaveLength(120);
    });

    it('throws when content exceeds 5000 characters', () => {
      expect(() =>
        Note.create({
          id: validId,
          accountId: validAccountId,
          title: 'Tiêu đề',
          content: 'x'.repeat(5001),
          now,
        }),
      ).toThrow(NoteValidationError);
    });

    it('accepts content up to 5000 characters', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'Tiêu đề',
        content: 'x'.repeat(5000),
        now,
      });
      expect(note.content).toHaveLength(5000);
    });

    it('throws when checklist exceeds 100 items', () => {
      const checklist = Array.from({ length: 101 }, (_, i) => ({
        id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        text: `Mục ${i}`,
        done: false,
      }));

      expect(() =>
        Note.create({
          id: validId,
          accountId: validAccountId,
          title: 'Tiêu đề',
          checklist,
          now,
        }),
      ).toThrow(NoteValidationError);
    });

    it('throws when checklist item has invalid UUID', () => {
      expect(() =>
        Note.create({
          id: validId,
          accountId: validAccountId,
          title: 'Tiêu đề',
          checklist: [{ id: 'not-a-uuid', text: 'Mục 1', done: false }],
          now,
        }),
      ).toThrow(NoteValidationError);
    });

    it('throws when checklist item has empty text', () => {
      expect(() =>
        Note.create({
          id: validId,
          accountId: validAccountId,
          title: 'Tiêu đề',
          checklist: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              text: '   ',
              done: false,
            },
          ],
          now,
        }),
      ).toThrow(NoteValidationError);
    });

    it('throws when tagIds exceeds 10', () => {
      const tagIds = Array.from({ length: 11 }, (_, i) => `tag-${i}`);
      expect(() =>
        Note.create({
          id: validId,
          accountId: validAccountId,
          title: 'Tiêu đề',
          tagIds,
          now,
        }),
      ).toThrow(NoteValidationError);
    });

    it('accepts valid YYYY-MM-DD dueDate', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'Tiêu đề',
        dueDate: '2026-11-15',
        now,
      });
      expect(note.dueDate).toBe('2026-11-15');
    });

    it('accepts valid ISO-8601 string dueDate', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'Tiêu đề',
        dueDate: '2026-11-15T08:30:00.000Z',
        now,
      });
      expect(note.dueDate).toBe('2026-11-15T08:30:00.000Z');
    });

    it('throws when dueDate is invalid string or invalid calendar date', () => {
      expect(() =>
        Note.create({
          id: validId,
          accountId: validAccountId,
          title: 'Tiêu đề',
          dueDate: '2026-02-31',
          now,
        }),
      ).toThrow(NoteValidationError);

      expect(() =>
        Note.create({
          id: validId,
          accountId: validAccountId,
          title: 'Tiêu đề',
          dueDate: 'invalid-date',
          now,
        }),
      ).toThrow(NoteValidationError);
    });
  });

  describe('create - completed rule (Domain rule Note completed)', () => {
    const item1 = {
      id: '22222222-2222-4222-8222-222222222222',
      text: 'Mục 1',
      done: true,
    };
    const item2Done = {
      id: '33333333-3333-4333-8333-333333333333',
      text: 'Mục 2',
      done: true,
    };
    const item2Pending = {
      id: '33333333-3333-4333-8333-333333333333',
      text: 'Mục 2',
      done: false,
    };

    it('branch 1: non-empty checklist all done -> completed is TRUE, ignoring client false', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'Tiêu đề',
        checklist: [item1, item2Done],
        completed: false, // client passed false
        now,
      });
      expect(note.completed).toBe(true);
    });

    it('branch 2: non-empty checklist with at least one pending -> completed is FALSE, ignoring client true', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'Tiêu đề',
        checklist: [item1, item2Pending],
        completed: true, // client passed true
        now,
      });
      expect(note.completed).toBe(false);
    });

    it('branch 3: empty checklist with client completed=true -> completed is TRUE', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'Tiêu đề',
        checklist: [],
        completed: true,
        now,
      });
      expect(note.completed).toBe(true);
    });

    it('branch 4: empty checklist with client completed=false -> completed is FALSE', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'Tiêu đề',
        checklist: [],
        completed: false,
        now,
      });
      expect(note.completed).toBe(false);
    });

    it('branch 5: empty checklist without client completed -> defaults to FALSE', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'Tiêu đề',
        checklist: [],
        now,
      });
      expect(note.completed).toBe(false);
    });
  });

  describe('update - completed rule & checklist replacement', () => {
    const updatedTime = new Date('2026-10-26T14:00:00.000Z');

    it('replaces entire checklist and sets completed=true when all items done', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'Tiêu đề',
        checklist: [],
        completed: false,
        now,
      });

      note.update({
        checklist: [
          { id: '22222222-2222-4222-8222-222222222222', text: 'Xong A', done: true },
          { id: '33333333-3333-4333-8333-333333333333', text: 'Xong B', done: true },
        ],
        completed: false, // ignored
        now: updatedTime,
      });

      expect(note.checklist).toHaveLength(2);
      expect(note.completed).toBe(true);
      expect(note.updatedAt).toEqual(updatedTime);
    });

    it('replaces entire checklist and sets completed=false when not all items done', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'Tiêu đề',
        checklist: [
          { id: '22222222-2222-4222-8222-222222222222', text: 'Xong A', done: true },
        ],
        now,
      });
      expect(note.completed).toBe(true);

      note.update({
        checklist: [
          { id: '22222222-2222-4222-8222-222222222222', text: 'Xong A', done: true },
          { id: '33333333-3333-4333-8333-333333333333', text: 'Chưa xong B', done: false },
        ],
        completed: true, // ignored
        now: updatedTime,
      });

      expect(note.checklist).toHaveLength(2);
      expect(note.completed).toBe(false);
    });

    it('clears checklist and takes client completed value', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'Tiêu đề',
        checklist: [
          { id: '22222222-2222-4222-8222-222222222222', text: 'Mục 1', done: false },
        ],
        now,
      });
      expect(note.completed).toBe(false);

      note.update({
        checklist: [],
        completed: true,
        now: updatedTime,
      });

      expect(note.checklist).toEqual([]);
      expect(note.completed).toBe(true);
    });

    it('updates completed manually when checklist is and remains empty', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'Tiêu đề',
        checklist: [],
        completed: false,
        now,
      });

      note.update({
        completed: true,
        now: updatedTime,
      });
      expect(note.completed).toBe(true);

      note.update({
        completed: false,
        now: updatedTime,
      });
      expect(note.completed).toBe(false);
    });

    it('ignores completed in update when existing checklist is non-empty and not replaced', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'Tiêu đề',
        checklist: [
          { id: '22222222-2222-4222-8222-222222222222', text: 'Mục 1', done: false },
        ],
        now,
      });
      expect(note.completed).toBe(false);

      note.update({
        completed: true, // ignored because checklist has incomplete items
        now: updatedTime,
      });
      expect(note.completed).toBe(false);
    });
  });

  describe('delete', () => {
    it('soft-deletes the note', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'Tiêu đề',
        now,
      });

      const deleteTime = new Date('2026-10-26T15:00:00.000Z');
      note.delete(deleteTime);

      expect(note.isDeleted()).toBe(true);
      expect(note.deletedAt).toEqual(deleteTime);
      expect(note.updatedAt).toEqual(deleteTime);
    });
  });

  describe('searchContent computation', () => {
    it('computes normalized searchContent across title, content, and checklist items text', () => {
      const note = Note.create({
        id: validId,
        accountId: validAccountId,
        title: 'Ôn tập Toán lớp 12',
        content: 'Chuẩn bị Đề thi thử học kỳ I',
        checklist: [
          { id: '22222222-2222-4222-8222-222222222222', text: 'Giải tích phân', done: false },
          { id: '33333333-3333-4333-8333-333333333333', text: 'Hình không gian', done: true },
        ],
        now,
      });

      const searchContent = note.getSearchContent();
      expect(searchContent).toContain('on tap toan lop 12');
      expect(searchContent).toContain('chuan bi de thi thu hoc ky i');
      expect(searchContent).toContain('giai tich phan');
      expect(searchContent).toContain('hinh khong gian');
    });
  });
});
