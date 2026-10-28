import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { PrismaService } from '../../src/infrastructure/persistence/prisma/prisma.service';

describe('Avatar Upload & Delete E2E (MinIO Real Storage)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;

  const validJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06,
  ]);

  const validPng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
  ]);

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

  async function registerAndGetToken(email = 'avatar.teacher@example.com'): Promise<{
    accessToken: string;
    userId: string;
  }> {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'password123',
      })
      .expect(201);

    return {
      accessToken: res.body.accessToken,
      userId: res.body.user.id,
    };
  }

  describe('Authentication and validation guards', () => {
    it('returns 401 unauthorized when no token provided', async () => {
      await request(app.getHttpServer())
        .post('/auth/profile/avatar')
        .attach('file', validJpeg, 'test.jpg')
        .expect(401);

      await request(app.getHttpServer()).delete('/auth/profile/avatar').expect(401);
    });

    it('returns 400 validation when no file is uploaded', async () => {
      const { accessToken } = await registerAndGetToken();

      const res = await request(app.getHttpServer())
        .post('/auth/profile/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(res.body).toEqual({
        code: 'validation',
        message: 'File is required',
      });
    });

    it('returns 413 file_too_large when file exceeds 2 MB', async () => {
      const { accessToken } = await registerAndGetToken();

      const largeBuffer = Buffer.alloc(2 * 1024 * 1024 + 50);
      validJpeg.copy(largeBuffer, 0);

      const res = await request(app.getHttpServer())
        .post('/auth/profile/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', largeBuffer, 'huge.jpg')
        .expect(413);

      expect(res.body).toEqual({
        code: 'file_too_large',
        message: 'File size exceeds 2 MB limit',
      });
    });

    it('returns 415 unsupported_file_type when file is not JPEG, PNG, or WebP', async () => {
      const { accessToken } = await registerAndGetToken();

      const fakePdf = Buffer.from('%PDF-1.5 fake document content');

      const res = await request(app.getHttpServer())
        .post('/auth/profile/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', fakePdf, 'document.pdf')
        .expect(415);

      expect(res.body).toEqual({
        code: 'unsupported_file_type',
        message: 'File type must be JPEG, PNG, or WebP',
      });
    });
  });

  describe('Upload, fetch, replace, and delete workflow against real MinIO container', () => {
    it('completes the full lifecycle of avatar management', async () => {
      const { accessToken, userId } = await registerAndGetToken();

      // Step 1: Upload JPEG avatar
      const uploadRes = await request(app.getHttpServer())
        .post('/auth/profile/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', validJpeg, 'photo.jpg')
        .expect(200);

      expect(uploadRes.body).toHaveProperty('avatarUrl');
      const firstAvatarUrl: string = uploadRes.body.avatarUrl;
      expect(firstAvatarUrl).toMatch(/^http:\/\/localhost:9000\/avatars\/[a-f0-9-]+\.jpg$/i);

      // Verify MinIO public HTTP GET returns the exact uploaded image
      const fetchFirst = await fetch(firstAvatarUrl);
      expect(fetchFirst.status).toBe(200);
      expect(fetchFirst.headers.get('content-type')).toBe('image/jpeg');
      const firstBuffer = Buffer.from(await fetchFirst.arrayBuffer());
      expect(firstBuffer).toEqual(validJpeg);

      // Verify DB state
      const dbProfile1 = await prisma.profile.findUnique({
        where: { accountId: userId },
      });
      expect(dbProfile1?.avatarUrl).toBe(firstAvatarUrl);
      expect(dbProfile1?.avatarKey).toBeDefined();

      // Step 2: Upload PNG avatar (replaces the previous JPEG avatar)
      const replaceRes = await request(app.getHttpServer())
        .post('/auth/profile/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', validPng, 'avatar.png')
        .expect(200);

      const secondAvatarUrl: string = replaceRes.body.avatarUrl;
      expect(secondAvatarUrl).toMatch(/^http:\/\/localhost:9000\/avatars\/[a-f0-9-]+\.png$/i);
      expect(secondAvatarUrl).not.toBe(firstAvatarUrl);

      // Verify new PNG on MinIO
      const fetchSecond = await fetch(secondAvatarUrl);
      expect(fetchSecond.status).toBe(200);
      expect(fetchSecond.headers.get('content-type')).toBe('image/png');
      const secondBuffer = Buffer.from(await fetchSecond.arrayBuffer());
      expect(secondBuffer).toEqual(validPng);

      // Verify OLD JPEG avatar was DELETED from MinIO
      const fetchOldAfterReplace = await fetch(firstAvatarUrl);
      expect(fetchOldAfterReplace.status).toBe(404);

      // Step 3: DELETE avatar
      const deleteRes = await request(app.getHttpServer())
        .delete('/auth/profile/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(deleteRes.body.avatarUrl).toBeUndefined();

      // Verify PNG avatar was DELETED from MinIO
      const fetchDeleted = await fetch(secondAvatarUrl);
      expect(fetchDeleted.status).toBe(404);

      // Verify DB state has null avatar
      const dbProfileDeleted = await prisma.profile.findUnique({
        where: { accountId: userId },
      });
      expect(dbProfileDeleted?.avatarUrl).toBeNull();
      expect(dbProfileDeleted?.avatarKey).toBeNull();

      // Step 4: GET /auth/me reflects no avatar
      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(meRes.body.avatarUrl).toBeUndefined();
    });

    it('does not attempt to delete storage object when user has an external Google avatar', async () => {
      const { accessToken, userId } = await registerAndGetToken('google.user@example.com');

      // Simulate profile having external Google avatar URL and null avatarKey
      const googleAvatarUrl = 'https://lh3.googleusercontent.com/a/external-avatar-photo';
      await prisma.profile.update({
        where: { accountId: userId },
        data: {
          avatarUrl: googleAvatarUrl,
          avatarKey: null,
        },
      });

      // DELETE avatar should succeed and set avatarUrl to null without error
      const deleteRes = await request(app.getHttpServer())
        .delete('/auth/profile/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(deleteRes.body.avatarUrl).toBeUndefined();

      const dbProfile = await prisma.profile.findUnique({
        where: { accountId: userId },
      });
      expect(dbProfile?.avatarUrl).toBeNull();
      expect(dbProfile?.avatarKey).toBeNull();
    });
  });
});
