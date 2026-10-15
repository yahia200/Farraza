import { z } from 'zod';
import { phoneSchema } from './phone.js';

/** Request bodies for applications: the public apply form and the pipeline. */

export const submitApplicationSchema = z.strictObject({
  name: z
    .string()
    .min(2, { error: 'Name must be at least 2 characters.' })
    .max(100, { error: 'Name must be 100 characters or fewer.' }),
  // Normalize first, then check the format, as the old @Transform + @IsEmail did.
  email: z
    .string()
    .trim()
    .normalize('NFC')
    .toLowerCase()
    .pipe(z.email({ error: 'Enter a valid email address.' })),
  /** Any common format in, E.164 out ("+201001234567"); see phone.ts. */
  phone: phoneSchema,
  /** Checked against the form's fields by `parseAnswers()` in the service. */
  answers: z.record(z.string(), z.unknown(), {
    error: 'Something went wrong sending your answers. Reload the page and try again.',
  }),
  /** Set from the link's `utm_source`, not typed by the applicant. */
  source: z.string().max(100).optional(),
  /** Honeypot: hidden in the page, so people leave it empty and bots fill it in. */
  website: z.string().optional(),
});
export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;

export const moveApplicationSchema = z.strictObject({
  stageId: z.uuid({ error: 'Choose a stage from this job.' }),
});
export type MoveApplicationInput = z.infer<typeof moveApplicationSchema>;

export const createNoteSchema = z.strictObject({
  body: z
    .string()
    .trim()
    .min(1, { error: 'Write something before saving the note.' })
    .max(5000, { error: 'Notes must be 5,000 characters or fewer.' }),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
