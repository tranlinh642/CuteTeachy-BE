import { Task } from '../../../src/domain/task/task.entity';
import { TaskValidationError } from '../../../src/domain/task/task.errors';

describe('Task Entity', () => {
  const validId = '11111111-1111-4111-8111-111111111111';
  const tagId1 = '22222222-2222-4222-8222-222222222222';
  const tagId2 = '33333333-3333-4333-8333-333333333333';
  const accountId = 'acc-1';
  const now = new Date('2026-10-26T12:00:00.000Z');

  describe('create', () => {
    it('creates a valid Task with all properties provided', () => {
      const task = Task.create({
        id: validId,
        accountId,
        title: '   Soạn giáo án tuần 10   ',
        notes: 'Ghi chú bài học chi tiết',
        date: '2026-10-27',
        time: '08:30',
        category: 'school',
        priority: 'high',
        completed: true,
        tagIds: [tagId1, tagId2],
        now,
      });

      expect(task.id).toBe(validId);
      expect(task.accountId).toBe(accountId);
      expect(task.title).toBe('Soạn giáo án tuần 10');
      expect(task.notes).toBe('Ghi chú bài học chi tiết');
      expect(task.date).toBe('2026-10-27');
      expect(task.time).toBe('08:30');
      expect(task.category).toBe('school');
      expect(task.priority).toBe('high');
      expect(task.completed).toBe(true);
      expect(task.tagIds).toEqual([tagId1, tagId2]);
      expect(task.createdAt).toEqual(now);
      expect(task.updatedAt).toEqual(now);
      expect(task.deletedAt).toBeNull();
      expect(task.isDeleted()).toBe(false);
    });

    it('creates a valid Task with default values', () => {
      const task = Task.create({
        id: validId,
        accountId,
        title: 'Mua quà',
        date: '2026-10-28',
        category: 'personal',
        now,
      });

      expect(task.title).toBe('Mua quà');
      expect(task.notes).toBeNull();
      expect(task.time).toBeNull();
      expect(task.priority).toBe('normal');
      expect(task.completed).toBe(false);
      expect(task.tagIds).toEqual([]);
      expect(task.isDeleted()).toBe(false);
    });

    it('throws TaskValidationError if id is not a valid UUID', () => {
      expect(() =>
        Task.create({
          id: 'invalid-uuid',
          accountId,
          title: 'Title',
          date: '2026-10-28',
          category: 'school',
          now,
        }),
      ).toThrow(TaskValidationError);
    });

    it('throws TaskValidationError if accountId is empty', () => {
      expect(() =>
        Task.create({
          id: validId,
          accountId: '  ',
          title: 'Title',
          date: '2026-10-28',
          category: 'school',
          now,
        }),
      ).toThrow(TaskValidationError);
    });

    it('throws TaskValidationError if title is empty or whitespace only', () => {
      expect(() =>
        Task.create({
          id: validId,
          accountId,
          title: '    ',
          date: '2026-10-28',
          category: 'school',
          now,
        }),
      ).toThrow(TaskValidationError);
    });

    it('throws TaskValidationError if title exceeds 120 characters', () => {
      expect(() =>
        Task.create({
          id: validId,
          accountId,
          title: 'a'.repeat(121),
          date: '2026-10-28',
          category: 'school',
          now,
        }),
      ).toThrow(TaskValidationError);
    });

    it('throws TaskValidationError if notes exceeds 1000 characters', () => {
      expect(() =>
        Task.create({
          id: validId,
          accountId,
          title: 'Title',
          notes: 'x'.repeat(1001),
          date: '2026-10-28',
          category: 'school',
          now,
        }),
      ).toThrow(TaskValidationError);
    });

    it('throws TaskValidationError if date format is invalid', () => {
      expect(() =>
        Task.create({
          id: validId,
          accountId,
          title: 'Title',
          date: '28-10-2026',
          category: 'school',
          now,
        }),
      ).toThrow(TaskValidationError);
    });

    it('throws TaskValidationError if date is not a valid calendar day', () => {
      expect(() =>
        Task.create({
          id: validId,
          accountId,
          title: 'Title',
          date: '2026-02-30',
          category: 'school',
          now,
        }),
      ).toThrow(TaskValidationError);
    });

    it('throws TaskValidationError if time format is invalid', () => {
      expect(() =>
        Task.create({
          id: validId,
          accountId,
          title: 'Title',
          date: '2026-10-28',
          time: '25:00',
          category: 'school',
          now,
        }),
      ).toThrow(TaskValidationError);
    });

    it('throws TaskValidationError if category is invalid', () => {
      expect(() =>
        Task.create({
          id: validId,
          accountId,
          title: 'Title',
          date: '2026-10-28',
          category: 'invalid' as any,
          now,
        }),
      ).toThrow(TaskValidationError);
    });

    it('throws TaskValidationError if priority is invalid', () => {
      expect(() =>
        Task.create({
          id: validId,
          accountId,
          title: 'Title',
          date: '2026-10-28',
          category: 'school',
          priority: 'urgent' as any,
          now,
        }),
      ).toThrow(TaskValidationError);
    });

    it('throws TaskValidationError if tagIds exceeds 10', () => {
      const tenTags = Array.from({ length: 11 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
      expect(() =>
        Task.create({
          id: validId,
          accountId,
          title: 'Title',
          date: '2026-10-28',
          category: 'school',
          tagIds: tenTags,
          now,
        }),
      ).toThrow(TaskValidationError);
    });

    it('throws TaskValidationError if tagIds has invalid UUID', () => {
      expect(() =>
        Task.create({
          id: validId,
          accountId,
          title: 'Title',
          date: '2026-10-28',
          category: 'school',
          tagIds: ['not-a-uuid'],
          now,
        }),
      ).toThrow(TaskValidationError);
    });
  });

  describe('update', () => {
    it('updates partial fields and refreshes updatedAt', () => {
      const task = Task.create({
        id: validId,
        accountId,
        title: 'Original title',
        date: '2026-10-28',
        category: 'school',
        now,
      });

      const updateTime = new Date('2026-10-26T14:00:00.000Z');
      task.update({
        title: 'New title',
        completed: true,
        priority: 'high',
        now: updateTime,
      });

      expect(task.title).toBe('New title');
      expect(task.completed).toBe(true);
      expect(task.priority).toBe('high');
      expect(task.updatedAt).toEqual(updateTime);
    });

    it('throws TaskValidationError when trying to update deleted task', () => {
      const task = Task.create({
        id: validId,
        accountId,
        title: 'Task',
        date: '2026-10-28',
        category: 'school',
        now,
      });

      task.delete(now);

      expect(() =>
        task.update({
          title: 'Updated',
          now: new Date(),
        }),
      ).toThrow(TaskValidationError);
    });
  });

  describe('delete', () => {
    it('soft deletes the task', () => {
      const task = Task.create({
        id: validId,
        accountId,
        title: 'Task',
        date: '2026-10-28',
        category: 'school',
        now,
      });

      const deleteTime = new Date('2026-10-26T15:00:00.000Z');
      task.delete(deleteTime);

      expect(task.isDeleted()).toBe(true);
      expect(task.deletedAt).toEqual(deleteTime);
      expect(task.updatedAt).toEqual(deleteTime);
    });

    it('calling delete again is idempotent and keeps the first delete timestamp', () => {
      const task = Task.create({
        id: validId,
        accountId,
        title: 'Task',
        date: '2026-10-28',
        category: 'school',
        now,
      });

      const firstDelete = new Date('2026-10-26T15:00:00.000Z');
      task.delete(firstDelete);

      const secondDelete = new Date('2026-10-26T16:00:00.000Z');
      task.delete(secondDelete);

      expect(task.deletedAt).toEqual(firstDelete);
      expect(task.updatedAt).toEqual(firstDelete);
    });
  });

  describe('reconstitute', () => {
    it('restores entity directly without validations', () => {
      const task = Task.reconstitute({
        id: validId,
        accountId,
        title: 'Restored',
        notes: 'Notes',
        date: '2026-10-28',
        time: '10:00',
        category: 'personal',
        priority: 'high',
        completed: true,
        tagIds: [tagId1],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      expect(task.id).toBe(validId);
      expect(task.title).toBe('Restored');
      expect(task.priority).toBe('high');
      expect(task.completed).toBe(true);
      expect(task.isDeleted()).toBe(false);
    });
  });
});
