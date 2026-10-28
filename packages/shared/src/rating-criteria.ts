import { z } from 'zod';
import { RELOAD_MESSAGE } from './messages.js';

/**
 * The Criteria catalog (.scratch/ratings/spec.md, GLOSSARY.md "Criterion"): the fixed list of things a
 * Job can ask its raters to score from 1 to 5, besides the overall rating. A Job picks up to
 * `RATING_CRITERIA_LIMIT` of them; the keys are stored in `jobs.rating_criteria` and inside each
 * Rating's `criteria`.
 *
 * APPEND-ONLY, like `PRESET_KEY_TYPES` in preset-keys.ts. Add Criteria freely; never remove or rename
 * a key. A Job keeps whatever keys it was saved with and a Rating keeps whatever scores it was saved
 * with, and both are read back through the schemas below. If a key left the catalog, that stored
 * selection or Rating could no longer be parsed. To retire a Criterion, stop offering it in the picker
 * and leave its key here. The label may be reworded (it is display text, never stored), but the key
 * is the identity.
 *
 * Keys are stable snake_case slugs rather than UUIDs because the catalog is fixed in code, not
 * created by users. The labels live here so the API and the web show the same words.
 */

/** The lowest and highest score, for the overall rating and for every Criterion. */
export const RATING_MIN = 1;
export const RATING_MAX = 5;

/** How many Criteria a Job can pick. */
export const RATING_CRITERIA_LIMIT = 5;

export const RATING_CRITERIA = [
  { key: 'technical_skills', label: 'Technical skills' },
  { key: 'problem_solving', label: 'Problem solving' },
  { key: 'communication', label: 'Communication' },
  { key: 'culture_fit', label: 'Culture fit' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'relevant_experience', label: 'Relevant experience' },
] as const;

export type RatingCriterionKey = (typeof RATING_CRITERIA)[number]['key'];

/** Every Criterion key, for building a schema from the catalog. */
export const RATING_CRITERION_KEYS = RATING_CRITERIA.map((criterion) => criterion.key) as [
  RatingCriterionKey,
  ...RatingCriterionKey[],
];

/** The Criteria a Job stores: at most `RATING_CRITERIA_LIMIT` catalog keys, none twice. Order carries no meaning. */
export const ratingCriteriaKeysSchema = z
  .array(z.enum(RATING_CRITERION_KEYS, { error: RELOAD_MESSAGE }), { error: RELOAD_MESSAGE })
  .max(RATING_CRITERIA_LIMIT, { error: `Choose up to ${RATING_CRITERIA_LIMIT} criteria.` })
  .superRefine((keys, ctx) => {
    keys.forEach((key, index) => {
      if (keys.indexOf(key) !== index) {
        ctx.addIssue({ code: 'custom', message: RELOAD_MESSAGE, path: [index] });
      }
    });
  });
