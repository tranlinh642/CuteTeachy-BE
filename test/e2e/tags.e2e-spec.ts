import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';

describe('Tags Sync Foundation E2E (HTTP API with real Postgres)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.taskTag.deleteMany();
    await prisma.noteTag.deleteMany();
    await prisma.task.deleteMany();
    await prisma.note.deleteMany();
    await prisma.tag.deleteMany();
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
        .send({ fullName: 'Cô Lan', displayName: 'Lan', gender: 'female' })
        .expect(200);
    }

    return { token, accountId };
  }

  describe('Guards: Auth and Onboarding', () => {
    it('returns 401 when no token is provided', async () => {
      await request(app.getHttpServer()).get('/tags').expect(401);
    });

    it('returns 403 onboarding_required when teacher has not completed onboarding', async () => {
      const { token } = await createTeacher('not.onboarded@example.com', false);

      const res = await request(app.getHttpServer())
        .get('/tags')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.code).toBe('onboarding_required');
    });
  });

  describe('POST /tags (Idempotent Creation)', () => {
    const tagId = '11111111-1111-4111-8111-111111111111';

    it('creates a new tag and returns 201 Created', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      const res = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: tagId,
          name: '   Toán 10A   ',
          tone: 'pink',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: tagId,
        name: 'Toán 10A',
        tone: 'pink',
      });
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.updatedAt).toBeDefined();
    });

    it('returns 200 OK with existing tag when called with same id by same teacher (idempotent)', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      // First call -> 201
      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: tagId,
          name: 'Toán 10A',
          tone: 'pink',
        })
        .expect(201);

      // Repeated call with different payload -> 200 returning existing tag
      const res = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: tagId,
          name: 'Toán 10A Khác',
          tone: 'blue',
        })
        .expect(200);

      expect(res.body.id).toBe(tagId);
      expect(res.body.name).toBe('Toán 10A');
      expect(res.body.tone).toBe('pink');
    });

    it('returns 410 gone when id was previously soft-deleted', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tagId, name: 'Toán 10', tone: 'pink' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/tags/${tagId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tagId, name: 'Toán 10', tone: 'pink' })
        .expect(410);

      expect(res.body.code).toBe('gone');
    });

    it('returns 409 id_conflict when id belongs to another teacher', async () => {
      const teacher1 = await createTeacher('teacher1@example.com');
      const teacher2 = await createTeacher('teacher2@example.com');

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send({ id: tagId, name: 'Toán 10', tone: 'pink' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${teacher2.token}`)
        .send({ id: tagId, name: 'Lý 11', tone: 'blue' })
        .expect(409);

      expect(res.body.code).toBe('id_conflict');
    });

    it('returns 409 tag_name_taken when name collides (case-insensitive) within same teacher', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tagId, name: 'Toán 10', tone: 'pink' })
        .expect(201);

      const anotherId = '22222222-2222-4222-8222-222222222222';
      const res = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: anotherId, name: '  toán 10  ', tone: 'blue' })
        .expect(409);

      expect(res.body.code).toBe('tag_name_taken');
    });

    it('allows same name across different teachers', async () => {
      const teacher1 = await createTeacher('teacher1@example.com');
      const teacher2 = await createTeacher('teacher2@example.com');

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send({ id: tagId, name: 'Toán 10', tone: 'pink' })
        .expect(201);

      const anotherId = '22222222-2222-4222-8222-222222222222';
      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${teacher2.token}`)
        .send({ id: anotherId, name: 'toán 10', tone: 'mint' })
        .expect(201);
    });

    it('validates name length 1-24 and tone enum', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      // Empty name
      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tagId, name: '   ', tone: 'pink' })
        .expect(400);

      // Name > 24 chars
      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tagId, name: 'Tên nhãn dài hơn 24 ký tự này nha', tone: 'pink' })
        .expect(400);

      // Invalid tone
      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tagId, name: 'Toán 10', tone: 'red' })
        .expect(400);
    });
  });

  describe('PATCH /tags/:id', () => {
    const tagId = '11111111-1111-4111-8111-111111111111';

    it('updates name and tone successfully', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tagId, name: 'Toán 10', tone: 'pink' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/tags/${tagId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Toán 10 Chuyên', tone: 'mint' })
        .expect(200);

      expect(res.body.name).toBe('Toán 10 Chuyên');
      expect(res.body.tone).toBe('mint');
    });

    it('returns 404 when tag does not exist or belongs to another teacher', async () => {
      const teacher1 = await createTeacher('teacher1@example.com');
      const teacher2 = await createTeacher('teacher2@example.com');

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send({ id: tagId, name: 'Toán 10', tone: 'pink' })
        .expect(201);

      // Teacher 2 attempts to patch Teacher 1's tag
      await request(app.getHttpServer())
        .patch(`/tags/${tagId}`)
        .set('Authorization', `Bearer ${teacher2.token}`)
        .send({ name: 'Toán Hacked' })
        .expect(404);
    });

    it('returns 404 when tag has been soft-deleted', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tagId, name: 'Toán 10', tone: 'pink' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/tags/${tagId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      await request(app.getHttpServer())
        .patch(`/tags/${tagId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Toán Hồi sinh' })
        .expect(404);
    });

    it('returns 409 tag_name_taken if renamed name collides with another tag in same account', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      const tagId2 = '22222222-2222-4222-8222-222222222222';
      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tagId, name: 'Toán 10', tone: 'pink' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tagId2, name: 'Văn 10', tone: 'blue' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/tags/${tagId2}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '  toán 10  ' })
        .expect(409);

      expect(res.body.code).toBe('tag_name_taken');
    });
  });

  describe('DELETE /tags/:id (Soft Delete)', () => {
    const tagId = '11111111-1111-4111-8111-111111111111';

    it('soft deletes tag and returns 204; repeated call returns 204', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tagId, name: 'Toán 10', tone: 'pink' })
        .expect(201);

      // First delete -> 204
      await request(app.getHttpServer())
        .delete(`/tags/${tagId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const dbTag = await prisma.tag.findUnique({ where: { id: tagId } });
      expect(dbTag).not.toBeNull();
      expect(dbTag?.deletedAt).not.toBeNull();

      // Repeated delete -> 204
      await request(app.getHttpServer())
        .delete(`/tags/${tagId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('returns 404 when tag does not exist or belongs to another teacher', async () => {
      const teacher1 = await createTeacher('teacher1@example.com');
      const teacher2 = await createTeacher('teacher2@example.com');

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send({ id: tagId, name: 'Toán 10', tone: 'pink' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/tags/${tagId}`)
        .set('Authorization', `Bearer ${teacher2.token}`)
        .expect(404);
    });

    it('unlinks tag from tasks and notes and updates their updatedAt in a single transaction', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      const tagA = '11111111-1111-4111-8111-111111111111';
      const tagB = '22222222-2222-4222-8222-222222222222';
      const taskId1 = '33333333-3333-4333-8333-333333333333';
      const taskId2 = '44444444-4444-4444-8444-444444444444';
      const noteId1 = '55555555-5555-4555-8555-555555555555';
      const noteId2 = '66666666-6666-4666-8666-666666666666';

      // 1. Create tags
      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tagA, name: 'Toán', tone: 'pink' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tagB, name: 'Văn', tone: 'blue' })
        .expect(201);

      // 2. Create tasks (Task 1 has tagA & tagB, Task 2 has only tagB)
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId1,
          title: 'Soạn đề Toán và Văn',
          date: '2026-10-26',
          category: 'school',
          tagIds: [tagA, tagB],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId2,
          title: 'Họp môn Văn',
          date: '2026-10-26',
          category: 'school',
          tagIds: [tagB],
        })
        .expect(201);

      // 3. Create notes (Note 1 has tagA, Note 2 has tagB)
      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: noteId1,
          title: 'Ghi chú Toán 10',
          content: 'Nội dung toán',
          tagIds: [tagA],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: noteId2,
          title: 'Ghi chú Văn 10',
          content: 'Nội dung văn',
          tagIds: [tagB],
        })
        .expect(201);

      // Get sync checkpoint from GET /tags
      const tagsList = await request(app.getHttpServer())
        .get('/tags')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const syncCheckpoint = tagsList.body.serverTime;

      // Small delay to ensure timestamp separation for delta sync
      await new Promise((r) => setTimeout(r, 50));

      // 4. Delete tagA
      await request(app.getHttpServer())
        .delete(`/tags/${tagA}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // 5. Verify GET /tasks?from=2026-10-01&to=2026-10-31&updatedSince=${syncCheckpoint}
      const taskDeltaRes = await request(app.getHttpServer())
        .get(`/tasks?from=2026-10-01&to=2026-10-31&updatedSince=${encodeURIComponent(syncCheckpoint)}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(taskDeltaRes.body.items).toHaveLength(1);
      expect(taskDeltaRes.body.items[0].id).toBe(taskId1);
      expect(taskDeltaRes.body.items[0].tagIds).toEqual([tagB]);

      // Verify GET /tasks full list
      const allTasksRes = await request(app.getHttpServer())
        .get('/tasks?from=2026-10-01&to=2026-10-31')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const returnedTask1 = allTasksRes.body.items.find((t: any) => t.id === taskId1);
      const returnedTask2 = allTasksRes.body.items.find((t: any) => t.id === taskId2);
      expect(returnedTask1.tagIds).toEqual([tagB]);
      expect(returnedTask2.tagIds).toEqual([tagB]);

      // 6. Verify GET /notes?updatedSince=${syncCheckpoint}
      const noteDeltaRes = await request(app.getHttpServer())
        .get(`/notes?updatedSince=${encodeURIComponent(syncCheckpoint)}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(noteDeltaRes.body.items).toHaveLength(1);
      expect(noteDeltaRes.body.items[0].id).toBe(noteId1);
      expect(noteDeltaRes.body.items[0].tagIds).toEqual([]);

      // Verify GET /notes full list
      const allNotesRes = await request(app.getHttpServer())
        .get('/notes')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const returnedNote1 = allNotesRes.body.items.find((n: any) => n.id === noteId1);
      const returnedNote2 = allNotesRes.body.items.find((n: any) => n.id === noteId2);
      expect(returnedNote1.tagIds).toEqual([]);
      expect(returnedNote2.tagIds).toEqual([tagB]);
    });
  });

  describe('GET /tags[?updatedSince] (Delta Sync Envelope)', () => {
    it('returns full active list and empty deletedIds when updatedSince is omitted', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      const tag1 = '11111111-1111-4111-8111-111111111111';
      const tag2 = '22222222-2222-4222-8222-222222222222';
      const tag3 = '33333333-3333-4333-8333-333333333333';

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tag1, name: 'Toán', tone: 'pink' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tag2, name: 'Lý', tone: 'blue' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tag3, name: 'Hoá', tone: 'mint' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/tags/${tag3}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .get('/tags')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.items.map((i: any) => i.id)).toEqual([tag1, tag2]);
      expect(res.body.deletedIds).toEqual([]);
      expect(res.body.serverTime).toBeDefined();
    });

    it('returns modified items and deletedIds when updatedSince is provided', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      const tag1 = '11111111-1111-4111-8111-111111111111';
      const tag2 = '22222222-2222-4222-8222-222222222222';

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tag1, name: 'Toán', tone: 'pink' })
        .expect(201);

      // Snapshot serverTime
      const listRes1 = await request(app.getHttpServer())
        .get('/tags')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const syncCheckpoint = listRes1.body.serverTime;

      // Small delay to ensure timestamp separation
      await new Promise((r) => setTimeout(r, 50));

      // Modify tag1 and create + delete tag2
      await request(app.getHttpServer())
        .patch(`/tags/${tag1}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Toán Nâng Cao' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: tag2, name: 'Lý', tone: 'blue' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/tags/${tag2}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Delta sync
      const deltaRes = await request(app.getHttpServer())
        .get(`/tags?updatedSince=${encodeURIComponent(syncCheckpoint)}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(deltaRes.body.items).toHaveLength(1);
      expect(deltaRes.body.items[0].id).toBe(tag1);
      expect(deltaRes.body.items[0].name).toBe('Toán Nâng Cao');
      expect(deltaRes.body.deletedIds).toEqual([tag2]);
    });

    it('returns 400 validation if updatedSince is older than 30 days', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      const thirtyTwoDaysAgo = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app.getHttpServer())
        .get(`/tags?updatedSince=${encodeURIComponent(thirtyTwoDaysAgo)}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.code).toBe('validation');
    });

    it('isolates data between teachers', async () => {
      const teacher1 = await createTeacher('teacher1@example.com');
      const teacher2 = await createTeacher('teacher2@example.com');

      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send({
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Toán Cô Lan',
          tone: 'pink',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/tags')
        .set('Authorization', `Bearer ${teacher2.token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(0);
    });
  });
});
