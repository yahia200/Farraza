import { z } from 'zod';
import { cvModeSchema } from './cv-mode.js';
import { MAX_FIELDS } from './form-fields.js';
import { highlightedQuestionKeysSchema } from './highlights.js';

/** Request bodies for the API's /companies/:companySlug/jobs endpoints. */

const title = z
  .string()
  .min(2, { error: 'Job title must be at least 2 characters.' })
  .max(120, { error: 'Job title must be 120 characters or fewer.' });
/** `null` clears the description, so it stays allowed (class-validator's `@IsOptional` let it through too). */
const description = z
  .string()
  .max(10000, { error: 'Description must be 10,000 characters or fewer.' })
  .nullish();

export const createJobSchema = z.strictObject({ title, description });
export type CreateJobInput = z.infer<typeof createJobSchema>;

// `title` is optional but, unlike before, not nullable: a null title used to
// pass validation and then fail on the NOT NULL column.
export const updateJobSchema = z.strictObject({ title: title.optional(), description });
export type UpdateJobInput = z.infer<typeof updateJobSchema>;

/**
 * Saving a form draft: the questions plus the CV setting. The array's items are left unchecked here: the
 * service validates them with `parseFormFields()`, which reports every issue.
 */
export const saveFormSchema = z.strictObject({
  fields: z
    .array(z.unknown())
    .max(MAX_FIELDS, { error: `A form can have at most ${MAX_FIELDS} questions.` }),
  cvMode: cvModeSchema,
});
export type SaveFormInput = z.infer<typeof saveFormSchema>;

/**
 * Saving a Job's Highlighted questions (PUT .../jobs/:jobSlug/highlighted-questions): the whole new
 * list of keys. The service then checks them against the latest published form (`checkHighlightKeys`).
 */
export const saveHighlightedQuestionsSchema = z.strictObject({ keys: highlightedQuestionKeysSchema });
export type SaveHighlightedQuestionsInput = z.infer<typeof saveHighlightedQuestionsSchema>;

/**
 * Response for the public company listing (GET /api/public/:companySlug): a
 * company's branding and every open job. Unlike the schemas above, which
 * validate request *bodies*, this is a *response* contract shared by the API
 * and the web app. The API builds its reply through it, so parsing doubles as
 * the public projection — an internal job field (id, status, timestamps) added
 * by mistake is dropped instead of leaked — and the web app parses what comes
 * back at the trust boundary. Branding is kept loose (plain nullable strings):
 * `logoUrl`/`brandColor` are already validated when saved (companies.ts), and
 * re-checking their format on read would only risk rejecting stored data.
 * Each job carries its `slug`, which the listing turns into an apply link
 * (/{companySlug}/{jobSlug}).
 */
/**
 * A company's public branding: the fields the applicant-facing pages render
 * directly (name, logo, brand color). It is both its own response contract —
 * GET /api/public/:companySlug/branding, which the public layout fetches once
 * to theme every page under it — and the `company` shape inside
 * `publicCompanyJobsSchema` below, so the two can't drift. Like the listing
 * schema, branding is kept loose (plain nullable strings): logoUrl/brandColor
 * are already validated when saved (companies.ts), and re-checking on read
 * would only risk rejecting stored data.
 */
export const publicBrandingSchema = z.object({
  name: z.string(),
  slug: z.string(),
  logoUrl: z.string().nullable(),
  brandColor: z.string().nullable(),
});
export type PublicBranding = z.infer<typeof publicBrandingSchema>;

export const publicCompanyJobsSchema = z.object({
  company: publicBrandingSchema,
  jobs: z.array(
    z.object({
      title: z.string(),
      slug: z.string(),
      description: z.string().nullable(),
    }),
  ),
});
export type PublicCompanyJobs = z.infer<typeof publicCompanyJobsSchema>;
