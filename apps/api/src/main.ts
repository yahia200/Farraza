import { NestFactory } from '@nestjs/core';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { toValidationException } from './common/validation-errors.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: 'http://localhost:3000', credentials: true });
  // Validates every @Body/@Query/@Param that declares `{ schema }` (Zod schemas
  // from @repo/shared); parameters without one pass through untouched.
  app.useGlobalPipes(new StandardSchemaValidationPipe({ exceptionFactory: toValidationException }));

  await app.listen(config.getOrThrow<number>('PORT'));
}
bootstrap();