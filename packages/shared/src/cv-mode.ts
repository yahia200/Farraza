import { z } from 'zod';

/**
 * Whether a job's form asks for a CV. It lives on the form version, not in
 * `fields` (ADR-0002), so changing it after publishing creates a new version.
 * Mirrors the `cv_mode` column on `form_versions`.
 */
export const CV_MODES = ['off', 'optional', 'required'] as const;

export const cvModeSchema = z.enum(CV_MODES, {
  error: 'Choose whether the form asks for a CV.',
});
export type CvMode = z.infer<typeof cvModeSchema>;

/** What the builder starts a brand-new job's form at. Existing forms default to `off` in the database. */
export const DEFAULT_CV_MODE: CvMode = 'optional';
