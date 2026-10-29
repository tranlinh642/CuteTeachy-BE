import { PrismaNoteReminderReader } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-note-reminder.repository';
import { PrismaTaskReminderReader } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-task-reminder.repository';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma/prisma.service';

describe('PrismaNoteReminderReader & PrismaTaskReminderReader', () => {
  const mockNoteFindMany = jest.fn().mockResolvedValue([]);
  const mockTaskFindMany = jest.fn().mockResolvedValue([]);

  const mockPrisma = {
    note: {
      findMany: mockNoteFindMany,
    },
    task: {
      findMany: mockTaskFindMany,
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PrismaNoteReminderReader', () => {
    it('queries notes using caller-provided fromDate and toDate without calling new Date()', async () => {
      const reader = new PrismaNoteReminderReader(mockPrisma);

      await reader.findUpcomingNotes('2026-10-26', '2026-10-28');

      expect(mockNoteFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            completed: false,
            deletedAt: null,
            dueDate: {
              not: null,
              gte: '2026-10-26',
              lte: '2026-10-28T23:59:59.999Z',
            },
          },
        }),
      );
    });

    it('uses single date as both fromDate and toDate when caller passes query.date or only fromDate', async () => {
      const reader = new PrismaNoteReminderReader(mockPrisma);

      await reader.findUpcomingNotes({ date: '2026-10-27' });

      expect(mockNoteFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            completed: false,
            deletedAt: null,
            dueDate: {
              not: null,
              gte: '2026-10-27',
              lte: '2026-10-27T23:59:59.999Z',
            },
          },
        }),
      );
    });
  });

  describe('PrismaTaskReminderReader', () => {
    it('queries tasks using caller-provided fromDate and toDate without calling new Date()', async () => {
      const reader = new PrismaTaskReminderReader(mockPrisma);

      await reader.findUpcomingTasks('2026-10-26', '2026-10-28');

      expect(mockTaskFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            completed: false,
            deletedAt: null,
            time: { not: null },
            date: {
              gte: '2026-10-26',
              lte: '2026-10-28',
            },
          },
        }),
      );
    });

    it('uses single date as both fromDate and toDate when caller passes query.date or only fromDate', async () => {
      const reader = new PrismaTaskReminderReader(mockPrisma);

      await reader.findUpcomingTasks({ date: '2026-10-27' });

      expect(mockTaskFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            completed: false,
            deletedAt: null,
            time: { not: null },
            date: {
              gte: '2026-10-27',
              lte: '2026-10-27',
            },
          },
        }),
      );
    });
  });
});
