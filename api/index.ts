import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express, Request, Response } from 'express';
import { AppModule } from '../src/composition/app.module';
import { setupApp } from '../src/setup-app';

let cachedServer: Express | null = null;
let bootstrapPromise: Promise<Express> | null = null;

async function bootstrapServer(): Promise<Express> {
  if (cachedServer) {
    return cachedServer;
  }
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const expressApp = express();
      const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
      setupApp(app);
      await app.init();
      cachedServer = expressApp;
      return expressApp;
    })().catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrapServer();
  server(req, res);
}
