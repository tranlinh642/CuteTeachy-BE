import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';

describe('Tasks E2E (HTTP API with real Postgres)', () => {
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
    await prisma.task.deleteMany();
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

  async function createTag(
    token: string,
    id: string,
    name: string,
    tone = 'pink',
  ): Promise<any> {
    const res = await request(app.getHttpServer())
      .post('/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ id, name, tone })
      .expect(201);
    return res.body;
  }

  describe('Guards: Auth and Onboarding', () => {
    it('returns 401 when no token is provided', async () => {
      await request(app.getHttpServer()).get('/tasks?from=2026-10-01&to=2026-10-31').expect(401);
    });

    it('returns 403 onboarding_required when teacher has not completed onboarding', async () => {
      const { token } = await createTeacher('not.onboarded@example.com', false);

      const res = await request(app.getHttpServer())
        .get('/tasks?from=2026-10-01&to=2026-10-31')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.code).toBe('onboarding_required');
    });
  });

  describe('POST /tasks (Idempotent Creation)', () => {
    const taskId = '11111111-1111-4111-8111-111111111111';
    const tagId = '22222222-2222-4222-8222-222222222222';

    it('creates a new task and returns 201 Created', async () => {
      const { token } = await createTeacher('teacher1@example.com');
      await createTag(token, tagId, 'Lớp 10A');

      const res = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId,
          title: 'Soạn giáo án',
          notes: 'Chi tiết bài 5',
          date: '2026-10-27',
          time: '08:30',
          category: 'school',
          priority: 'high',
          tagIds: [tagId],
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: taskId,
        title: 'Soạn giáo án',
        notes: 'Chi tiết bài 5',
        date: '2026-10-27',
        time: '08:30',
        category: 'school',
        priority: 'high',
        completed: false,
        tagIds: [tagId],
      });
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.updatedAt).toBeDefined();
    });

    it('returns 200 OK with existing task on duplicate creation by same teacher (idempotent)', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId,
          title: 'Soạn giáo án ban đầu',
          date: '2026-10-27',
          category: 'school',
        })
        .expect(201);

      const duplicateRes = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId,
          title: 'Tiêu đề khác bị bỏ qua',
          date: '2026-10-28',
          category: 'personal',
        })
        .expect(200);

      expect(duplicateRes.body.title).toBe('Soạn giáo án ban đầu');
    });

    it('returns 409 Conflict (id_conflict) when id belongs to another teacher', async () => {
      const { token: token1 } = await createTeacher('teacher1@example.com');
      const { token: token2 } = await createTeacher('teacher2@example.com');

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          id: taskId,
          title: 'Task của teacher 1',
          date: '2026-10-27',
          category: 'school',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token2}`)
        .send({
          id: taskId,
          title: 'Task của teacher 2 trùng id',
          date: '2026-10-27',
          category: 'personal',
        })
        .expect(409);

      expect(res.body.code).toBe('id_conflict');
    });

    it('returns 410 Gone when id was previously soft-deleted', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId,
          title: 'Task sẽ bị xoá',
          date: '2026-10-27',
          category: 'school',
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId,
          title: 'Task tạo lại trên id đã xoá',
          date: '2026-10-27',
          category: 'school',
        })
        .expect(410);

      expect(res.body.code).toBe('gone');
    });

    it('returns 400 validation when tagId belongs to another teacher', async () => {
      const { token: teacher1Token } = await createTeacher('teacher1@example.com');
      const { token: teacher2Token } = await createTeacher('teacher2@example.com');

      await createTag(teacher2Token, tagId, 'Nhãn của teacher 2');

      const res = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          id: taskId,
          title: 'Task dùng nhãn người khác',
          date: '2026-10-27',
          category: 'school',
          tagIds: [tagId],
        })
        .expect(400);

      expect(res.body.code).toBe('validation');
    });

    it('returns 400 validation when tagId is soft-deleted', async () => {
      const { token } = await createTeacher('teacher1@example.com');
      await createTag(token, tagId, 'Nhãn sắp xoá');

      await request(app.getHttpServer())
        .delete(`/tags/${tagId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId,
          title: 'Task dùng nhãn đã xoá',
          date: '2026-10-27',
          category: 'school',
          tagIds: [tagId],
        })
        .expect(400);

      expect(res.body.code).toBe('validation');
    });

    it('returns 400 validation when validation rules fail', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      // title empty
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId,
          title: '',
          date: '2026-10-27',
          category: 'school',
        })
        .expect(400);

      // title > 120 chars
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId,
          title: 'a'.repeat(121),
          date: '2026-10-27',
          category: 'school',
        })
        .expect(400);

      // date invalid format
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId,
          title: 'Test',
          date: '2026/10/27',
          category: 'school',
        })
        .expect(400);

      // time invalid format
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId,
          title: 'Test',
          date: '2026-10-27',
          time: '25:00',
          category: 'school',
        })
        .expect(400);

      // category invalid
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId,
          title: 'Test',
          date: '2026-10-27',
          category: 'other',
        })
        .expect(400);

      // > 10 tags
      const elevenTags = Array.from(
        { length: 11 },
        (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      );
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId,
          title: 'Test',
          date: '2026-10-27',
          category: 'school',
          tagIds: elevenTags,
        })
        .expect(400);
    });
  });

  describe('GET /tasks?from&to[&updatedSince]', () => {
    it('returns 400 validation if from or to is missing', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      await request(app.getHttpServer())
        .get('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      await request(app.getHttpServer())
        .get('/tasks?from=2026-10-01')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns 400 validation if date range exceeds 42 days', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      const res = await request(app.getHttpServer())
        .get('/tasks?from=2026-10-01&to=2026-11-13')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.code).toBe('validation');
    });

    it('returns 200 envelope with tasks in date range', async () => {
      const { token: teacher1Token } = await createTeacher('teacher1@example.com');
      const { token: teacher2Token } = await createTeacher('teacher2@example.com');

      const task1Id = '11111111-1111-4111-8111-111111111111';
      const task2Id = '22222222-2222-4222-8222-222222222222';
      const task3Id = '33333333-3333-4333-8333-333333333333';

      // Task 1: in range for teacher 1
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          id: task1Id,
          title: 'Task trong khoảng',
          date: '2026-10-15',
          category: 'school',
        })
        .expect(201);

      // Task 2: outside range for teacher 1
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          id: task2Id,
          title: 'Task ngoài khoảng',
          date: '2026-11-20',
          category: 'school',
        })
        .expect(201);

      // Task 3: in range for teacher 2
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({
          id: task3Id,
          title: 'Task của teacher 2',
          date: '2026-10-15',
          category: 'school',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/tasks?from=2026-10-01&to=2026-10-31')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(task1Id);
      expect(res.body.deletedIds).toEqual([]);
      expect(res.body.serverTime).toBeDefined();
    });

    it('returns 400 validation if updatedSince is older than 30 days', async () => {
      const { token } = await createTeacher('teacher1@example.com');
      const oldDate = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app.getHttpServer())
        .get(`/tasks?from=2026-10-01&to=2026-10-31&updatedSince=${oldDate}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.code).toBe('validation');
    });

    it('returns updated items and deletedIds with updatedSince', async () => {
      const { token } = await createTeacher('teacher1@example.com');
      const task1Id = '11111111-1111-4111-8111-111111111111';
      const task2Id = '22222222-2222-4222-8222-222222222222';

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: task1Id,
          title: 'Task 1',
          date: '2026-10-15',
          category: 'school',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: task2Id,
          title: 'Task 2 sắp xoá',
          date: '2026-10-16',
          category: 'personal',
        })
        .expect(201);

      // Record sync time
      const initialGet = await request(app.getHttpServer())
        .get('/tasks?from=2026-10-01&to=2026-10-31')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const syncCheckpoint = initialGet.body.serverTime;

      // Small delay to ensure timestamp difference
      await new Promise((r) => setTimeout(r, 100));

      // Update task 1
      await request(app.getHttpServer())
        .patch(`/tasks/${task1Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true })
        .expect(200);

      // Delete task 2
      await request(app.getHttpServer())
        .delete(`/tasks/${task2Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Sync with checkpoint
      const syncRes = await request(app.getHttpServer())
        .get(`/tasks?from=2026-10-01&to=2026-10-31&updatedSince=${syncCheckpoint}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(syncRes.body.items).toHaveLength(1);
      expect(syncRes.body.items[0].id).toBe(task1Id);
      expect(syncRes.body.items[0].completed).toBe(true);
      expect(syncRes.body.deletedIds).toEqual([task2Id]);
    });
  });

  describe('PATCH /tasks/:id (Partial Update, Last-Write-Wins)', () => {
    const taskId = '11111111-1111-4111-8111-111111111111';
    const tagId = '22222222-2222-4222-8222-222222222222';

    it('partially updates the task and sets last-write-wins updatedAt', async () => {
      const { token } = await createTeacher('teacher1@example.com');
      await createTag(token, tagId, 'Nhãn mới');

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId,
          title: 'Tiêu đề gốc',
          date: '2026-10-27',
          category: 'school',
          priority: 'normal',
        })
        .expect(201);

      const patchRes = await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Tiêu đề sửa đổi',
          priority: 'high',
          completed: true,
          tagIds: [tagId],
        })
        .expect(200);

      expect(patchRes.body.title).toBe('Tiêu đề sửa đổi');
      expect(patchRes.body.priority).toBe('high');
      expect(patchRes.body.completed).toBe(true);
      expect(patchRes.body.tagIds).toEqual([tagId]);
    });

    it('allows clearing notes and time by passing null', async () => {
      const { token } = await createTeacher('teacher-clear@example.com');
      const clearTaskId = '33333333-3333-4333-8333-333333333333';

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: clearTaskId,
          title: 'Task co notes va time',
          notes: 'Ban dau',
          time: '08:30',
          date: '2026-10-27',
          category: 'school',
        })
        .expect(201);

      const patchRes = await request(app.getHttpServer())
        .patch(`/tasks/${clearTaskId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          notes: null,
          time: null,
        })
        .expect(200);

      expect(patchRes.body.notes).toBeUndefined();
      expect(patchRes.body.time).toBeUndefined();

      const inDb = await prisma.task.findUnique({ where: { id: clearTaskId } });
      expect(inDb?.notes).toBeNull();
      expect(inDb?.time).toBeNull();
    });

    it('returns 404 when updating non-existent task', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      const res = await request(app.getHttpServer())
        .patch('/tasks/99999999-9999-4999-8999-999999999999')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Không tìm thấy' })
        .expect(404);

      expect(res.body.code).toBe('not_found');
    });

    it('returns 404 when updating task belonging to another teacher', async () => {
      const { token: teacher1Token } = await createTeacher('teacher1@example.com');
      const { token: teacher2Token } = await createTeacher('teacher2@example.com');

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          id: taskId,
          title: 'Task của teacher 1',
          date: '2026-10-27',
          category: 'school',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ title: 'Sửa trộm' })
        .expect(404);

      expect(res.body.code).toBe('not_found');
    });

    it('returns 404 when updating soft-deleted task', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId,
          title: 'Task sẽ xoá',
          date: '2026-10-27',
          category: 'school',
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Cố sửa sau xoá' })
        .expect(404);

      expect(res.body.code).toBe('not_found');
    });
  });

  describe('DELETE /tasks/:id (Soft Delete)', () => {
    const taskId = '11111111-1111-4111-8111-111111111111';

    it('soft deletes task and repeated calls return 204 No Content', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: taskId,
          title: 'Task để xoá',
          date: '2026-10-27',
          category: 'school',
        })
        .expect(201);

      // First delete -> 204
      await request(app.getHttpServer())
        .delete(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Check DB record has deletedAt
      const inDb = await prisma.task.findUnique({ where: { id: taskId } });
      expect(inDb?.deletedAt).not.toBeNull();

      // Repeated delete -> 204 (idempotent)
      await request(app.getHttpServer())
        .delete(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('returns 404 when deleting task belonging to another teacher', async () => {
      const { token: teacher1Token } = await createTeacher('teacher1@example.com');
      const { token: teacher2Token } = await createTeacher('teacher2@example.com');

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          id: taskId,
          title: 'Task teacher 1',
          date: '2026-10-27',
          category: 'school',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .delete(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .expect(404);

      expect(res.body.code).toBe('not_found');
    });

    it('returns 404 when deleting non-existent task', async () => {
      const { token } = await createTeacher('teacher1@example.com');

      const res = await request(app.getHttpServer())
        .delete('/tasks/99999999-9999-4999-8999-999999999999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(res.body.code).toBe('not_found');
    });
  });
});
