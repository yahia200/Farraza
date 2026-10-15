import { NestFactory } from '@nestjs/core';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { toValidationException } from './common/validation-errors.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  // The web app's origin (APP_URL in .env), the only one allowed to call with cookies.
  app.enableCors({ origin: config.getOrThrow<string>('APP_URL'), credentials: true });
  app.enableCors({ origin: "http://192.168.1.100:3000", credentials: true });
  // Validates every @Body/@Query/@Param that declares `{ schema }` (Zod schemas
  // from @repo/shared); parameters without one pass through untouched.
  app.useGlobalPipes(new StandardSchemaValidationPipe({ exceptionFactory: toValidationException }));

  await app.listen(config.getOrThrow<number>('PORT'));
}
bootstrap();