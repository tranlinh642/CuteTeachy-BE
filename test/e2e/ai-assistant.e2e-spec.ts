import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';
import { AI_ASSISTANT_PORT } from '../../src/application/ai-assistant/ports/ai-assistant.port';
import { OBJECT_STORAGE } from '../../src/application/avatar/ports/object-storage.port';
import { FakeAiAssistant } from '../fakes/fake-ai-assistant';
import { FakeObjectStorage } from '../fakes/fake-object-storage';

describe('AI Assistant E2E (Seam 1 — HTTP API & DB Integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let fakeAi: FakeAiAssistant;
  let fakeStorage: FakeObjectStorage;

  const validJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);

  beforeAll(async () => {
    fakeAi = new FakeAiAssistant();
    fakeStorage = new FakeObjectStorage('http://localhost:9000/avatars');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AI_ASSISTANT_PORT)
      .useValue(fakeAi)
      .overrideProvider(OBJECT_STORAGE)
      .useValue(fakeStorage)
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    fakeAi.clear();
    fakeStorage.clear();
    await prisma.aiChatMessage.deleteMany();
    await prisma.classSession.deleteMany();
    await prisma.timetableSlot.deleteMany();
    await prisma.taskTag.deleteMany();
    await prisma.task.deleteMany();
    await prisma.noteTag.deleteMany();
    await prisma.note.deleteMany();
    await prisma.rateLimitCounter.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.loginProvider.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.account.deleteMany();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function createTeacher(
    email: string,
    completedOnboarding = true,
  ): Promise<{ token: string; accountId: string }> {
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);

    const token = registerRes.body.accessToken;
    const accountId = registerRes.body.user.id;

    if (completedOnboarding) {
      await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: 'Cô Mai', displayName: 'Mai', gender: 'female' })
        .expect(200);
    }

    return { token, accountId };
  }

  describe('Auth & Validation Guards', () => {
    it('returns 401 when unauthenticated and 403 when onboarding is incomplete', async () => {
      await request(app.getHttpServer()).get('/ai-assistant/messages').expect(401);

      const { token } = await createTeacher('unonboarded@example.com', false);
      const res = await request(app.getHttpServer())
        .get('/ai-assistant/messages')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(res.body.code).toBe('onboarding_required');
    });

    it('returns 400 validation_error when neither text nor image is sent, or image is invalid / > 5MB', async () => {
      const { token } = await createTeacher('valid.teacher@example.com');

      const emptyRes = await request(app.getHttpServer())
        .post('/ai-assistant/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: '   ' })
        .expect(400);
      expect(emptyRes.body.code).toBe('validation_error');

      const invalidFile = Buffer.from('%PDF-1.5 not an image');
      const badFormatRes = await request(app.getHttpServer())
        .post('/ai-assistant/messages')
        .set('Authorization', `Bearer ${token}`)
        .attach('image', invalidFile, {
          filename: 'schedule.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);
      expect(badFormatRes.body.code).toBe('validation_error');

      const oversizedJpeg = Buffer.alloc(5 * 1024 * 1024 + 100);
      validJpeg.copy(oversizedJpeg, 0);
      const hugeRes = await request(app.getHttpServer())
        .post('/ai-assistant/messages')
        .set('Authorization', `Bearer ${token}`)
        .attach('image', oversizedJpeg, {
          filename: 'huge.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);
      expect(hugeRes.body.code).toBe('validation_error');
    });
  });

  describe('End-to-End Multimodal Draft Flow, Conflict Resolution, and 45-Day Image Cleanup', () => {
    it('processes timetable image, detects conflicts, applies draft (replace_conflicts) into TimetableSlots/ClassSessions/Tasks, and prevents duplicate apply (409)', async () => {
      const { token } = await createTeacher('ai.flow@example.com');

      // 1. Create an existing TimetableSlot on Monday (weekday = 1) 07:00-07:45
      const existingSlotId = '11111111-1111-4111-8111-111111111111';
      await request(app.getHttpServer())
        .post('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: existingSlotId,
          weekday: 1,
          startTime: '07:00',
          endTime: '07:45',
          subject: 'Toán 9A (Cũ)',
          grade: '9A',
          room: 'P.101',
          tone: 'pink',
          category: 'school_teaching',
          effectiveFrom: '2026-09-01',
        })
        .expect(201);

      // 2. Configure FakeAiAssistant response with 3 draft items (timetable_slot, class_session, task)
      fakeAi.setNextReply({
        reply: 'Em đã đọc ảnh TKB và tạo bản nháp 3 mục cho cô.',
        draftItems: [
          {
            id: 'draft-slot-1',
            kind: 'timetable_slot',
            category: 'school_teaching',
            titleOrSubject: 'Toán Hình 9A (Mới)',
            grade: '9A',
            room: 'P.202',
            weekday: 1,
            startTime: '07:00',
            endTime: '07:45',
            effectiveFrom: '2026-10-29',
            tone: 'blue',
          },
          {
            id: 'draft-session-1',
            kind: 'class_session',
            category: 'extra_teaching',
            titleOrSubject: 'Phụ đạo Toán 9B',
            grade: '9B',
            room: 'Phòng học nhóm',
            date: '2026-10-30',
            startTime: '18:00',
            endTime: '19:30',
            tone: 'lavender',
          },
          {
            id: 'draft-task-1',
            kind: 'task',
            category: 'self_study',
            titleOrSubject: 'Ôn luyện đề Reading IELTS',
            date: '2026-10-30',
            startTime: '20:00',
          },
        ],
      });

      // 3. Send multipart/form-data message with image
      const sendRes = await request(app.getHttpServer())
        .post('/ai-assistant/messages')
        .set('Authorization', `Bearer ${token}`)
        .field('message', 'Cập nhật lịch từ ảnh TKB này')
        .attach('image', validJpeg, {
          filename: 'tkb.jpg',
          contentType: 'image/jpeg',
        })
        .expect(200);

      expect(sendRes.body.userMessage.imageUrl).toContain('http://localhost:9000/avatars/ai-chat/');
      expect(sendRes.body.userMessage.imageExpiresAt).toBeDefined();

      const assistantMsg = sendRes.body.assistantMessage;
      expect(assistantMsg.draft.status).toBe('pending');
      expect(assistantMsg.draft.items).toHaveLength(3);
      expect(assistantMsg.draft.items[0].conflict).toEqual({
        slotId: existingSlotId,
        subject: 'Toán 9A (Cũ)',
        startTime: '07:00',
        endTime: '07:45',
      });

      // 4. Apply draft with replace_conflicts
      const applyRes = await request(app.getHttpServer())
        .post(`/ai-assistant/drafts/${assistantMsg.id}/apply`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          conflictStrategy: 'replace_conflicts',
          items: assistantMsg.draft.items,
        })
        .expect(200);

      expect(applyRes.body.summary).toEqual({
        createdCount: 3,
        replacedCount: 1,
        skippedCount: 0,
      });
      expect(applyRes.body.message.draft.status).toBe('applied');

      // 5. Re-applying the same draft returns 409 ai_draft_already_applied
      const duplicateApplyRes = await request(app.getHttpServer())
        .post(`/ai-assistant/drafts/${assistantMsg.id}/apply`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          conflictStrategy: 'skip_conflicts',
        })
        .expect(409);
      expect(duplicateApplyRes.body.code).toBe('ai_draft_already_applied');

      // 6. Verify GET /timetable-slots, GET /class-sessions, and GET /tasks reflect the applied items
      const slotsRes = await request(app.getHttpServer())
        .get('/timetable-slots')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const oldSlot = slotsRes.body.items.find((s: any) => s.id === existingSlotId);
      const newSlot = slotsRes.body.items.find(
        (s: any) => s.subject === 'Toán Hình 9A (Mới)',
      );
      expect(oldSlot.effectiveTo).toBe('2026-10-28');
      expect(newSlot).toBeDefined();
      expect(newSlot.category).toBe('school_teaching');

      const sessionsRes = await request(app.getHttpServer())
        .get('/class-sessions?from=2026-10-29&to=2026-10-31')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const extraSession = sessionsRes.body.items.find(
        (s: any) => s.subject === 'Phụ đạo Toán 9B',
      );
      expect(extraSession).toBeDefined();
      expect(extraSession.category).toBe('extra_teaching');

      const tasksRes = await request(app.getHttpServer())
        .get('/tasks?from=2026-10-29&to=2026-10-31')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const studyTask = tasksRes.body.items.find(
        (t: any) => t.title === 'Ôn luyện đề Reading IELTS',
      );
      expect(studyTask).toBeDefined();
      expect(studyTask.category).toBe('personal');
    });

    it('purges expired chat images during housekeeping while keeping message text, and supports DELETE /ai-assistant/messages', async () => {
      const { token } = await createTeacher('cleanup.teacher@example.com');

      fakeAi.setNextReply({ reply: 'Đã lưu ảnh TKB' });
      const sendRes = await request(app.getHttpServer())
        .post('/ai-assistant/messages')
        .set('Authorization', `Bearer ${token}`)
        .field('message', 'Ảnh TKB cần tự xóa sau 45 ngày')
        .attach('image', validJpeg, {
          filename: 'expire.jpg',
          contentType: 'image/jpeg',
        })
        .expect(200);

      const userMsgId: string = sendRes.body.userMessage.id;

      // Backdate imageExpiresAt in DB to simulate 45 days elapsed
      await prisma.aiChatMessage.update({
        where: { id: userMsgId },
        data: {
          imageExpiresAt: new Date(Date.now() - 60 * 1000),
        },
      });

      // Trigger reminder dispatcher housekeeping
      await request(app.getHttpServer())
        .post('/internal/reminders/dispatch')
        .set('X-Cron-Secret', process.env.CRON_SECRET || 'dev-cron-secret-token')
        .expect(200);

      // Verify image was deleted from storage and nulled in DB while preserving text
      expect(fakeStorage.deleteCalls).toHaveLength(1);
      const historyRes = await request(app.getHttpServer())
        .get('/ai-assistant/messages')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const purgedUserMsg = historyRes.body.items.find((m: any) => m.id === userMsgId);
      expect(purgedUserMsg.content).toBe('Ảnh TKB cần tự xóa sau 45 ngày');
      expect(purgedUserMsg.imageUrl).toBeNull();
      expect(purgedUserMsg.imageExpiresAt).toBeNull();

      // Clear history -> 204
      await request(app.getHttpServer())
        .delete('/ai-assistant/messages')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const afterClear = await request(app.getHttpServer())
        .get('/ai-assistant/messages')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(afterClear.body.items).toHaveLength(0);
    });
  });
});
