import { NestFactory } from '@nestjs/core';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureBodyParsers } from './common/body-limits.js';
import { AppModule } from './app.module.js';
import { toValidationException } from './common/validation-errors.js';

async function bootstrap() {
  // Nest's own body parsers are off: configureBodyParsers sets a larger JSON
  // limit for the public submit route only (common/body-limits.ts).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configureBodyParsers(app);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  // The web app's origin (APP_URL in .env), the only one allowed to call with cookies.
  app.enableCors({ origin: config.getOrThrow<string>('APP_URL'), credentials: true });
  // Refuses state-changing requests a browser reports as cross-origin (Fetch
  // Metadata, then Origin vs Host), unless the Origin is trusted. Server Actions
  // call the API server-to-server with neither header, so they pass; GETs (the
  // OIDC login and callback) always do. CORS origins aren't trusted implicitly:
  // node_modules/@nestjs/common/interfaces/http/csrf-protection-options.interface.d.ts
  app.enableCsrfProtection({
    trustedOrigins: [config.getOrThrow<string>('APP_URL')],
  });
  // Security response headers (CSP, HSTS, nosniff, ...). Built into Nest 12.1 with
  // helmet 8's defaults and option names, so no helmet package is needed:
  // node_modules/@nestjs/common/interfaces/http/security-headers-options.interface.d.ts
  app.useSecurityHeaders();
  // Validates every @Body/@Query/@Param that declares `{ schema }` (Zod schemas
  // from @repo/shared); parameters without one pass through untouched.
  app.useGlobalPipes(new StandardSchemaValidationPipe({ exceptionFactory: toValidationException }));

  await app.listen(config.getOrThrow<number>('PORT'));
}
bootstrap();