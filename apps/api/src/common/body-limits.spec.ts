import { Body, Controller, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { configureBodyParsers } from './body-limits.js';

@Controller('public/:companySlug/:jobSlug')
class FakePublicController {
  @Post('applications')
  submit(@Body() body: { text: string }) {
    return { length: body.text.length };
  }

  @Post('uploads')
  upload(@Body() body: { text: string }) {
    return { length: body.text.length };
  }
}

const KB = 1024;
// The JSON body is `{"text":"..."}`, so `chars` ASCII characters make a body a few bytes bigger.
const body = (chars: number) => ({ text: 'a'.repeat(chars) });

describe('configureBodyParsers', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [FakePublicController] }).compile();
    // The same options main.ts uses: Nest's own parsers off, ours on.
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureBodyParsers(app);
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(() => app.close());

  it('lets the submit route take a body well over the 100 kB default', async () => {
    await request(app.getHttpServer())
      .post('/api/public/acme/engineer/applications')
      .send(body(300 * KB))
      .expect(201)
      .expect({ length: 300 * KB });
  });

  it('refuses a submit body over 1 MB with 413', async () => {
    await request(app.getHttpServer())
      .post('/api/public/acme/engineer/applications')
      .send(body(1024 * KB + 10))
      .expect(413);
  });

  it('keeps the 100 kB default on every other route', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/api/public/acme/engineer/uploads')
      .send(body(90 * KB))
      .expect(201);
    await request(server)
      .post('/api/public/acme/engineer/uploads')
      .send(body(101 * KB))
      .expect(413);
  });
});
