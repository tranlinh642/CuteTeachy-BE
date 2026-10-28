import { ListNotesUseCase } from '../../../../src/application/note/list-notes.use-case';
import { FakeNoteRepository } from './fake-note.repository';
import { FixedClock } from '../../../fakes/fixed-clock';
import { Note } from '../../../../src/domain/note/note.entity';
import { SyncValidationError } from '../../../../src/domain/shared/sync.errors';
import { NoteValidationError } from '../../../../src/domain/note/note.errors';

describe('ListNotesUseCase', () => {
  let noteRepo: FakeNoteRepository;
  let clock: FixedClock;
  let useCase: ListNotesUseCase;

  const accountId = 'teacher-1';
  const now = new Date('2026-10-26T12:00:00.000Z');

  beforeEach(() => {
    noteRepo = new FakeNoteRepository();
    clock = new FixedClock(now);
    useCase = new ListNotesUseCase(noteRepo, clock);
  });

  describe('pagination with cursor', () => {
    beforeEach(async () => {
      // Create 5 notes with distinct timestamps
      for (let i = 1; i <= 5; i++) {
        const time = new Date(now.getTime() - (5 - i) * 60000); // 1 is oldest, 5 is newest
        const note = Note.create({
          id: `00000000-0000-4000-8000-00000000000${i}`,
          accountId,
          title: `Note ${i}`,
          now: time,
        });
        await noteRepo.save(note);
      }
    });

    it('returns first page with default limit 20 and nextCursor when limit < total', async () => {
      const page1 = await useCase.execute({ accountId, limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.items[0].title).toBe('Note 5'); // newest first
      expect(page1.items[1].title).toBe('Note 4');
      expect(page1.nextCursor).toBeDefined();

      const page2 = await useCase.execute({
        accountId,
        limit: 2,
        cursor: page1.nextCursor,
      });
      expect(page2.items).toHaveLength(2);
      expect(page2.items[0].title).toBe('Note 3');
      expect(page2.items[1].title).toBe('Note 2');
      expect(page2.nextCursor).toBeDefined();

      const page3 = await useCase.execute({
        accountId,
        limit: 2,
        cursor: page2.nextCursor,
      });
      expect(page3.items).toHaveLength(1);
      expect(page3.items[0].title).toBe('Note 1');
      expect(page3.nextCursor).toBeUndefined(); // end of pages
    });

    it('iterates through all items without duplicates or missing items', async () => {
      const collectedIds: string[] = [];
      let cursor: string | undefined = undefined;

      do {
        const res = await useCase.execute({ accountId, limit: 2, cursor });
        collectedIds.push(...res.items.map((it) => it.id));
        cursor = res.nextCursor;
      } while (cursor);

      expect(collectedIds).toHaveLength(5);
      expect(new Set(collectedIds).size).toBe(5);
      expect(collectedIds).toEqual([
        '00000000-0000-4000-8000-000000000005',
        '00000000-0000-4000-8000-000000000004',
        '00000000-0000-4000-8000-000000000003',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000001',
      ]);
    });

    it('throws validation error if limit is invalid (< 1 or > 50)', async () => {
      await expect(useCase.execute({ accountId, limit: 0 })).rejects.toThrow(
        NoteValidationError,
      );
      await expect(useCase.execute({ accountId, limit: 51 })).rejects.toThrow(
        NoteValidationError,
      );
    });

    it('throws validation error if cursor is corrupted/invalid', async () => {
      await expect(
        useCase.execute({ accountId, cursor: 'invalid-base64-random' }),
      ).rejects.toThrow(NoteValidationError);
    });
  });

  describe('unaccented search (q) and tag filtering', () => {
    beforeEach(async () => {
      const note1 = Note.create({
        id: '11111111-1111-4111-8111-111111111111',
        accountId,
        title: 'Ôn tập Toán cuối kỳ',
        content: 'Chương 1 và 2',
        tagIds: ['tag-math'],
        now: new Date('2026-10-26T08:00:00.000Z'),
      });
      const note2 = Note.create({
        id: '22222222-2222-4222-8222-222222222222',
        accountId,
        title: 'Họp phụ huynh',
        content: 'Bàn về kế hoạch học tập',
        checklist: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            text: 'Điểm danh đầu giờ',
            done: false,
          },
        ],
        tagIds: ['tag-admin'],
        now: new Date('2026-10-26T09:00:00.000Z'),
      });
      const note3 = Note.create({
        id: '33333333-3333-4333-8333-333333333333',
        accountId,
        title: 'Đánh giá học sinh giỏi',
        content: 'Khen thưởng cuối tuần',
        tagIds: ['tag-math'],
        now: new Date('2026-10-26T10:00:00.000Z'),
      });

      await noteRepo.save(note1);
      await noteRepo.save(note2);
      await noteRepo.save(note3);
    });

    it('searches unaccented query "on tap" to find "Ôn tập"', async () => {
      const res = await useCase.execute({ accountId, q: 'on tap' });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].title).toBe('Ôn tập Toán cuối kỳ');
    });

    it('searches unaccented query "danh dau" across checklist text to find "Điểm danh đầu giờ"', async () => {
      const res = await useCase.execute({ accountId, q: 'danh dau' });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].title).toBe('Họp phụ huynh');
    });

    it('searches unaccented "danh gia" to find "Đánh giá"', async () => {
      const res = await useCase.execute({ accountId, q: 'danh gia' });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].title).toBe('Đánh giá học sinh giỏi');
    });

    it('filters by tagId', async () => {
      const res = await useCase.execute({ accountId, tagId: 'tag-math' });
      expect(res.items).toHaveLength(2);
      expect(res.items.map((i) => i.title)).toContain('Ôn tập Toán cuối kỳ');
      expect(res.items.map((i) => i.title)).toContain('Đánh giá học sinh giỏi');
    });

    it('combines tagId and q', async () => {
      const res = await useCase.execute({
        accountId,
        tagId: 'tag-math',
        q: 'khen thuong',
      });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].title).toBe('Đánh giá học sinh giỏi');
    });
  });

  describe('updatedSince (delta sync)', () => {
    it('returns delta envelope with items and deletedIds', async () => {
      const note1 = Note.create({
        id: '11111111-1111-4111-8111-111111111111',
        accountId,
        title: 'Active note',
        now: new Date('2026-10-26T11:00:00.000Z'),
      });
      const note2 = Note.create({
        id: '22222222-2222-4222-8222-222222222222',
        accountId,
        title: 'Deleted note',
        now: new Date('2026-10-26T11:30:00.000Z'),
      });
      note2.delete(new Date('2026-10-26T11:45:00.000Z'));

      await noteRepo.save(note1);
      await noteRepo.save(note2);

      const res = await useCase.execute({
        accountId,
        updatedSince: '2026-10-26T10:00:00.000Z',
      });

      expect(res.items).toHaveLength(1);
      expect(res.items[0].id).toBe(note1.id);
      expect(res.deletedIds).toEqual([note2.id]);
      expect(res.nextCursor).toBeUndefined();
      expect(res.serverTime).toBe(now.toISOString());
    });

    it('throws validation error if updatedSince is used together with cursor', async () => {
      await expect(
        useCase.execute({
          accountId,
          updatedSince: '2026-10-26T10:00:00.000Z',
          cursor: 'some-cursor',
        }),
      ).rejects.toThrow(SyncValidationError);
    });

    it('throws validation error if updatedSince is used together with q', async () => {
      await expect(
        useCase.execute({
          accountId,
          updatedSince: '2026-10-26T10:00:00.000Z',
          q: 'toan',
        }),
      ).rejects.toThrow(SyncValidationError);
    });

    it('throws validation error if updatedSince is used together with tagId', async () => {
      await expect(
        useCase.execute({
          accountId,
          updatedSince: '2026-10-26T10:00:00.000Z',
          tagId: 'tag-1',
        }),
      ).rejects.toThrow(SyncValidationError);
    });

    it('throws validation error if updatedSince is older than 30 days', async () => {
      const olderThan30Days = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString();
      await expect(
        useCase.execute({
          accountId,
          updatedSince: olderThan30Days,
        }),
      ).rejects.toThrow(SyncValidationError);
    });
  });
});
