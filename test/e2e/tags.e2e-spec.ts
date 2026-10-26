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
