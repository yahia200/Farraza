import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';

/**
 * The public submit route (`POST /api/public/:companySlug/:jobSlug/applications`,
 * with the `api` global prefix). Express matches the raw path, so the prefix is
 * spelled out here.
 */
export const SUBMIT_ROUTE = '/api/public/:companySlug/:jobSlug/applications';

/**
 * JSON body limit for the submit route only. It equals the web app's Server
 * Action limit (1 MB, `serverActions.bodySizeLimit`), so the web hop is always
 * the first to refuse and this one never is. The apply form can carry the
 * applicant's CV text on top of up to 10,000 characters per long answer, which
 * the default does not allow (ticket: .scratch/cv-autofill/issues/01-*.md).
 */
export const SUBMIT_BODY_LIMIT = '1mb';

/**
 * Registers the body parsers in place of Nest's own (create the app with
 * `{ bodyParser: false }`): a larger JSON limit on the submit route, and
 * express's default (100 kB) everywhere else, as Nest would have set it up.
 *
 * Order matters. The submit route's parser goes first and reads the body;
 * body-parser skips a request whose body is already read, so the default
 * parser after it passes those requests through.
 *
 * Docs: `useBodyParser` in node_modules/@nestjs/platform-express/interfaces/nest-express-application.interface.d.ts;
 * `limit` in node_modules/.pnpm/body-parser@2.4.0*\/node_modules/body-parser/README.md.
 */
export function configureBodyParsers(app: NestExpressApplication): void {
  app.use(SUBMIT_ROUTE, json({ limit: SUBMIT_BODY_LIMIT }));
  app.useBodyParser('json');
  app.useBodyParser('urlencoded', { extended: true });
}
