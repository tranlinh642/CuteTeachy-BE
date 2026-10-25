import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/composition/app.module';
import { setupApp } from '../../src/setup-app';
import { HEALTH_CHECKER } from '../../src/application/shared/ports/health-checker.port';

describe('GET /health (e2e)', () => {
  jest.setTimeout(30000);

  describe('with healthy database (Postgres from docker-compose)', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      setupApp(app);
      await app.init();
    }, 30000);

    afterAll(async () => {
      if (app) {
        await app.close();
      }
    });

    it('returns HTTP 200 and { status: "ok" }', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('with failing database connection', () => {
    let unhealthyApp: INestApplication;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(HEALTH_CHECKER)
        .useValue({
          isHealthy: async () => false,
        })
        .compile();

      unhealthyApp = moduleFixture.createNestApplication();
      setupApp(unhealthyApp);
      await unhealthyApp.init();
    }, 30000);

    afterAll(async () => {
      if (unhealthyApp) {
        await unhealthyApp.close();
      }
    });

    it('returns HTTP 503 and error payload when DB is unhealthy', async () => {
      const response = await request(unhealthyApp.getHttpServer()).get('/health').expect(503);

      expect(response.body).toEqual({
        code: 'service_unavailable',
        message: 'Database is unreachable',
      });
    });
  });
});
