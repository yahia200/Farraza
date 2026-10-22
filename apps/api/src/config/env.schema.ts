import { z } from 'zod';

/*
 * An http(s) URL. Plain `z.url()` accepts any scheme, so `localhost:3000`
 * (no `http://`) passes as scheme "localhost:". `z.httpUrl()` also requires a
 * dotted hostname, which rejects `localhost` and IP addresses used in dev.
 * Docs: `url`/`httpUrl` in node_modules/zod/v4/classic/schemas.d.ts, and the
 * `protocol` option on `$ZodURLDef` in node_modules/zod/v4/core/schemas.d.ts.
 */
const httpUrl = () => z.url({ protocol: /^https?$/ });

/*
 * Boot-time validation of the API's environment (CLAUDE.md env list).
 * Wired into `ConfigModule.forRoot({ validate })` in app.module.ts, so a
 * missing or malformed variable stops the app at startup, not at first use.
 *
 * `@nestjs/config` passes the whole `process.env` here, so this is a plain
 * (non-strict) object: it validates the keys it names and leaves every other
 * variable (PATH, NODE_ENV, ...) untouched. Docs: @nestjs/config .d.ts in
 * apps/api/node_modules/@nestjs/config, and docs/nestjs/auth.md (config hint).
 */
export const envSchema = z.object({
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().min(1),
  // The web app's origin: CORS origin and the session's trusted origin.
  APP_URL: httpUrl(),
  // Shared with the web app so the API trusts its forwarded client address.
  INTERNAL_API_SECRET: z.string().min(16),

  // Object storage (RustFS in dev, S3-compatible in prod).
  S3_BUCKET: z.string().min(1),
  S3_ENDPOINT: httpUrl(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).optional(),

  // Google OAuth client (type "Web application"). See
  // docs/adr/0003-oidc-through-the-web-app.md for why the callback is
  // registered on the web origin.
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  // Read only for the SMTP_URL rule below.
  NODE_ENV: z.string().optional(),

  // Mail: SMTP_URL sends real email; without it, LogMailTransport prints to
  // the log (development and tests only: required in production, below).
  // MAIL_FROM is the envelope sender.
  SMTP_URL: z.url().optional(),
  MAIL_FROM: z.string().min(1).default('Farraza <accounts@farraza.app>'),
})
  // In production a missing SMTP_URL would silently log verification and reset
  // links instead of sending them. `refine` with `path` reports the issue on
  // SMTP_URL. Docs: `refine` in node_modules/zod/v4/classic/schemas.d.ts,
  // `$ZodCustomParams` (`path`) in node_modules/zod/v4/core/api.d.ts.
  .refine((env) => env.NODE_ENV !== 'production' || env.SMTP_URL !== undefined, {
    path: ['SMTP_URL'],
    message: 'SMTP_URL is required when NODE_ENV is "production" (without it, email is only logged)',
  });

/** Throws a readable list of problems, so boot fails fast and legibly. */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${problems}`);
  }
  // Keep every other process.env key; override only the ones we coerced/defaulted.
  return { ...config, ...parsed.data };
}
