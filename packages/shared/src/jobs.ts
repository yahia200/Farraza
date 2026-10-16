import { z } from 'zod';
import { cvModeSchema } from './cv-mode.js';
import { MAX_FIELDS } from './form-fields.js';

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
