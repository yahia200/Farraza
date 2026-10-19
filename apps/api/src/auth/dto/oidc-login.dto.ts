import { z } from 'zod';

/**
 * The query of `GET /auth/oidc/:provider/login`, validated by
 * StandardSchemaValidationPipe via `@Query({ schema })`. API-only (the web
 * Route Handler just forwards these two keys), so it lives here rather than in
 * @repo/shared.
 *
 * `redirectTo` is only typed here: OidcService keeps it only when it is a
 * relative path (`OidcStartOptions` in
 * node_modules/@nestjs/authentication/dist/interfaces/oidc.interface.d.ts).
 * `link` is "true" or "false" (absent means false) and arrives as a boolean.
 */
export const oidcLoginQuerySchema = z.strictObject({
  redirectTo: z.string().optional(),
  link: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export type OidcLoginQueryDto = z.output<typeof oidcLoginQuerySchema>;
