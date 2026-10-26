import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';

describe('Notes E2E (HTTP API with real Postgres)', () => {
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
    await prisma.noteTag.deleteMany();
    await prisma.note.deleteMany();
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
        .send({ fullName: 'Thầy Hưng', displayName: 'Hưng', gender: 'male' })
        .expect(200);
    }

    return { token, accountId };
  }

  async function createTag(
    token: string,
    id: string,
    name: string,
    tone = 'mint',
  ): Promise<{ id: string; name: string; tone: string }> {
    const res = await request(app.getHttpServer())
      .post('/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ id, name, tone })
      .expect(201);
    return res.body;
  }

  describe('Guards: Auth and Onboarding', () => {
    it('returns 401 when no token is provided', async () => {
      await request(app.getHttpServer()).get('/notes').expect(401);
    });

    it('returns 403 onboarding_required when teacher has not completed onboarding', async () => {
      const { token } = await createTeacher('pending.teacher@example.com', false);

      const res = await request(app.getHttpServer())
        .get('/notes')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.code).toBe('onboarding_required');
    });
  });

  describe('POST /notes (Idempotent Creation & Validation)', () => {
    const noteId = '11111111-1111-4111-8111-111111111111';
    const tagId = '22222222-2222-4222-8222-222222222222';

    it('creates a note with 201 Created and all fields', async () => {
      const { token } = await createTeacher('teacher1@example.com');
      await createTag(token, tagId, 'Chuyên môn');

      const res = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: noteId,
          title: 'Kế hoạch ôn thi học kỳ I',
          content: 'Phân công giáo viên ra đề',
          checklist: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              text: 'Ra đề Toán',
              done: false,
            },
          ],
          tagIds: [tagId],
          dueDate: '2026-11-20',
        })
        .expect(201);

      expect(res.body.id).toBe(noteId);
      expect(res.body.title).toBe('Kế hoạch ôn thi học kỳ I');
      expect(res.body.content).toBe('Phân công giáo viên ra đề');
      expect(res.body.checklist).toHaveLength(1);
      expect(res.body.tagIds).toEqual([tagId]);
      expect(res.body.dueDate).toBe('2026-11-20');
      expect(res.body.completed).toBe(false);
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.updatedAt).toBeDefined();
    });

    it('is idempotent: returns 200 OK with existing note when creating again with same id', async () => {
      const { token } = await createTeacher('teacher2@example.com');

      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: noteId, title: 'Bản gốc' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: noteId, title: 'Bản gửi lại khác title' })
        .expect(200);

      expect(res.body.id).toBe(noteId);
      expect(res.body.title).toBe('Bản gốc');
    });

    it('returns 409 id_conflict when different teacher tries to use existing note id', async () => {
      const teacher1 = await createTeacher('owner@example.com');
      const teacher2 = await createTeacher('other@example.com');

      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send({ id: noteId, title: 'Note của T1' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${teacher2.token}`)
        .send({ id: noteId, title: 'Note của T2 tranh id' })
        .expect(409);

      expect(res.body.code).toBe('id_conflict');
    });

    it('returns 410 gone when recreating an id that has been soft-deleted', async () => {
      const { token } = await createTeacher('teacher3@example.com');

      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: noteId, title: 'Note sắp xoá' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: noteId, title: 'Tạo lại note đã xoá' })
        .expect(410);

      expect(res.body.code).toBe('gone');
    });

    it('returns 400 validation when title is invalid, content is too long, or tag does not belong to user', async () => {
      const teacher1 = await createTeacher('teacher4@example.com');
      const teacher2 = await createTeacher('teacher5@example.com');
      const alienTag = await createTag(teacher2.token, tagId, 'Tag của T2');

      // Empty title
      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send({ id: noteId, title: '   ' })
        .expect(400);

      // Alien tag
      const res = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send({ id: noteId, title: 'Hợp lệ', tagIds: [alienTag.id] })
        .expect(400);
      expect(res.body.code).toBe('validation');

      // Invalid dueDate
      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send({ id: noteId, title: 'Hợp lệ', dueDate: '2026-02-31' })
        .expect(400);
    });
  });

  describe('Domain rule: completed according to checklist', () => {
    it('sets completed=true when all checklist items are done, ignoring client completed=false', async () => {
      const { token } = await createTeacher('teacher_comp1@example.com');

      const res = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Checklist done',
          checklist: [
            { id: '22222222-2222-4222-8222-222222222222', text: 'Item 1', done: true },
            { id: '33333333-3333-4333-8333-333333333333', text: 'Item 2', done: true },
          ],
          completed: false, // client says false
        })
        .expect(201);

      expect(res.body.completed).toBe(true);
    });

    it('sets completed=false when at least one item is not done, ignoring client completed=true', async () => {
      const { token } = await createTeacher('teacher_comp2@example.com');

      const res = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Checklist not done',
          checklist: [
            { id: '22222222-2222-4222-8222-222222222222', text: 'Item 1', done: true },
            { id: '33333333-3333-4333-8333-333333333333', text: 'Item 2', done: false },
          ],
          completed: true, // client says true
        })
        .expect(201);

      expect(res.body.completed).toBe(false);
    });

    it('sets completed from client when checklist is empty', async () => {
      const { token } = await createTeacher('teacher_comp3@example.com');

      const res = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Empty checklist note',
          checklist: [],
          completed: true,
        })
        .expect(201);

      expect(res.body.completed).toBe(true);
    });
  });

  describe('PATCH /notes/:id', () => {
    const noteId = '11111111-1111-4111-8111-111111111111';

    it('replaces entire checklist and updates completed', async () => {
      const { token } = await createTeacher('teacher_patch1@example.com');

      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: noteId,
          title: 'Checklist note',
          checklist: [
            { id: '22222222-2222-4222-8222-222222222222', text: 'Item 1', done: false },
          ],
        })
        .expect(201);

      // Replace checklist with 2 items all done
      const res = await request(app.getHttpServer())
        .patch(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          checklist: [
            { id: '22222222-2222-4222-8222-222222222222', text: 'Item 1', done: true },
            { id: '33333333-3333-4333-8333-333333333333', text: 'Item 2', done: true },
          ],
        })
        .expect(200);

      expect(res.body.checklist).toHaveLength(2);
      expect(res.body.completed).toBe(true);
    });

    it('returns 404 when note does not exist or belongs to another teacher', async () => {
      const teacher1 = await createTeacher('patch_t1@example.com');
      const teacher2 = await createTeacher('patch_t2@example.com');

      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send({ id: noteId, title: 'Note T1' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${teacher2.token}`)
        .send({ title: 'Hack' })
        .expect(404);
    });

    it('returns 404 when note was soft-deleted', async () => {
      const { token } = await createTeacher('patch_del@example.com');

      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: noteId, title: 'Note deleted' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      await request(app.getHttpServer())
        .patch(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Try update' })
        .expect(404);
    });
  });

  describe('DELETE /notes/:id', () => {
    const noteId = '11111111-1111-4111-8111-111111111111';

    it('soft deletes with 204 and is idempotent on repeat DELETE', async () => {
      const { token } = await createTeacher('del_teacher@example.com');

      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: noteId, title: 'Note' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Repeat delete should still return 204
      await request(app.getHttpServer())
        .delete(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Should not be in normal list
      const listRes = await request(app.getHttpServer())
        .get('/notes')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(listRes.body.items).toHaveLength(0);
    });

    it('returns 404 when note belongs to another teacher', async () => {
      const teacher1 = await createTeacher('del_t1@example.com');
      const teacher2 = await createTeacher('del_t2@example.com');

      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${teacher1.token}`)
        .send({ id: noteId, title: 'Note T1' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${teacher2.token}`)
        .expect(404);
    });
  });

  describe('GET /notes (Pagination & Cursor)', () => {
    it('paginates stably with nextCursor without duplicates or omissions', async () => {
      const { token } = await createTeacher('paginate_t@example.com');

      // Create 5 notes with small delays or distinct updatedAts
      for (let i = 1; i <= 5; i++) {
        await request(app.getHttpServer())
          .post('/notes')
          .set('Authorization', `Bearer ${token}`)
          .send({
            id: `00000000-0000-4000-8000-00000000000${i}`,
            title: `Note ${i}`,
          })
          .expect(201);
      }

      // Page 1: limit 2
      const page1 = await request(app.getHttpServer())
        .get('/notes?limit=2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(page1.body.items).toHaveLength(2);
      expect(page1.body.nextCursor).toBeDefined();

      // Page 2: limit 2 with cursor
      const page2 = await request(app.getHttpServer())
        .get(`/notes?limit=2&cursor=${page1.body.nextCursor}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(page2.body.items).toHaveLength(2);
      expect(page2.body.nextCursor).toBeDefined();

      // Page 3: last item
      const page3 = await request(app.getHttpServer())
        .get(`/notes?limit=2&cursor=${page2.body.nextCursor}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(page3.body.items).toHaveLength(1);
      expect(page3.body.nextCursor).toBeUndefined();

      // Ensure all 5 items were returned with no overlap
      const allIds = [
        ...page1.body.items.map((i: any) => i.id),
        ...page2.body.items.map((i: any) => i.id),
        ...page3.body.items.map((i: any) => i.id),
      ];
      expect(allIds).toHaveLength(5);
      expect(new Set(allIds).size).toBe(5);
    });

    it('returns 400 when limit > 50 or limit < 1', async () => {
      const { token } = await createTeacher('limit_err@example.com');

      await request(app.getHttpServer())
        .get('/notes?limit=0')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      await request(app.getHttpServer())
        .get('/notes?limit=51')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('GET /notes (Vietnamese Unaccented Search & Tag Filtering)', () => {
    it('finds notes using unaccented query on title, content, or checklist text', async () => {
      const { token } = await createTeacher('search_t@example.com');
      const tag = await createTag(token, '99999999-9999-4999-8999-999999999999', 'Toán Học');

      // Note 1: title has "Ôn tập"
      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Ôn tập học kỳ I',
          content: 'Lý thuyết đại số',
          tagIds: [tag.id],
        })
        .expect(201);

      // Note 2: content has "Đề cương kiểm tra"
      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: '22222222-2222-4222-8222-222222222222',
          title: 'Kế hoạch tuần',
          content: 'Soạn Đề cương kiểm tra giữa kỳ',
        })
        .expect(201);

      // Note 3: checklist item text has "Đánh dấu bài khó"
      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: '33333333-3333-4333-8333-333333333333',
          title: 'Bài tập về nhà',
          checklist: [
            {
              id: '44444444-4444-4444-8444-444444444444',
              text: 'Đánh dấu bài khó',
              done: false,
            },
          ],
        })
        .expect(201);

      // Search "on tap" -> matches Note 1
      const res1 = await request(app.getHttpServer())
        .get('/notes?q=on tap')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res1.body.items).toHaveLength(1);
      expect(res1.body.items[0].id).toBe('11111111-1111-4111-8111-111111111111');

      // Search "de cuong" -> matches Note 2
      const res2 = await request(app.getHttpServer())
        .get('/notes?q=de cuong')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res2.body.items).toHaveLength(1);
      expect(res2.body.items[0].id).toBe('22222222-2222-4222-8222-222222222222');

      // Search "danh dau" in checklist item text -> matches Note 3
      const res3 = await request(app.getHttpServer())
        .get('/notes?q=danh dau')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res3.body.items).toHaveLength(1);
      expect(res3.body.items[0].id).toBe('33333333-3333-4333-8333-333333333333');

      // Filter by tagId
      const resTag = await request(app.getHttpServer())
        .get(`/notes?tagId=${tag.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(resTag.body.items).toHaveLength(1);
      expect(resTag.body.items[0].id).toBe('11111111-1111-4111-8111-111111111111');
    });
  });

  describe('GET /notes?updatedSince (Delta Sync Envelope)', () => {
    it('returns delta envelope with items and deletedIds', async () => {
      const { token } = await createTeacher('sync_t@example.com');
      const note1Id = '11111111-1111-4111-8111-111111111111';
      const note2Id = '22222222-2222-4222-8222-222222222222';

      const past = new Date(Date.now() - 5000).toISOString();

      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: note1Id, title: 'Note còn sống' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: note2Id, title: 'Note sắp xoá' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/notes/${note2Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .get(`/notes?updatedSince=${past}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(note1Id);
      expect(res.body.deletedIds).toEqual([note2Id]);
      expect(res.body.serverTime).toBeDefined();
    });

    it('returns 400 validation when updatedSince is combined with cursor, q, or tagId', async () => {
      const { token } = await createTeacher('sync_err@example.com');
      const past = new Date().toISOString();

      const res1 = await request(app.getHttpServer())
        .get(`/notes?updatedSince=${past}&cursor=dummy`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      expect(res1.body.code).toBe('validation');

      const res2 = await request(app.getHttpServer())
        .get(`/notes?updatedSince=${past}&q=toan`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      expect(res2.body.code).toBe('validation');

      const res3 = await request(app.getHttpServer())
        .get(`/notes?updatedSince=${past}&tagId=11111111-1111-4111-8111-111111111111`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      expect(res3.body.code).toBe('validation');
    });

    it('returns 400 validation when updatedSince is older than 30 days', async () => {
      const { token } = await createTeacher('sync_old@example.com');
      const oldTime = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app.getHttpServer())
        .get(`/notes?updatedSince=${oldTime}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.code).toBe('validation');
    });
  });
});
