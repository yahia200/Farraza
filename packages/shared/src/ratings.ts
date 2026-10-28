import { z } from 'zod';
import type { FieldError } from './form-fields.js';
import { RATING_CRITERION_KEYS, RATING_MAX, RATING_MIN, type RatingCriterionKey } from './rating-criteria.js';

/*
 * Ratings (GLOSSARY.md "Rating", "Criterion", "Average rating"): a Member's score for an Application,
 * 1 to 5, and optionally a 1 to 5 score for each Criterion the Job uses.
 */

const SCORE_MESSAGE = `Choose a rating from ${RATING_MIN} to ${RATING_MAX}.`;

/** One score: a whole number from `RATING_MIN` to `RATING_MAX`. `z.int()` also refuses NaN and Infinity. */
const scoreSchema = z
  .int({ error: SCORE_MESSAGE })
  .min(RATING_MIN, { error: SCORE_MESSAGE })
  .max(RATING_MAX, { error: SCORE_MESSAGE });

/**
 * A Rating's Criteria scores: catalog key to a score, or `null` to clear that Criterion's score. A key
 * may be absent (skipped). `partialRecord`, not `record`: with an enum for keys `record` demands every
 * key, and a rater may skip any Criterion. A key outside the catalog is refused.
 */
export const ratingCriteriaScoresSchema = z.partialRecord(z.enum(RATING_CRITERION_KEYS), scoreSchema.nullable());
export type RatingCriteriaScores = z.infer<typeof ratingCriteriaScoresSchema>;

/**
 * Giving or replacing the caller's own Rating (PUT .../applications/:id/rating). `overall` is the
 * rater's own judgement and is required; it is never worked out from the Criteria. There is no user
 * in the body: the Member comes from the session. Whether each Criterion is one the Job uses is the
 * service's call (`checkRatingCriteria`).
 */
export const saveRatingSchema = z.strictObject({
  overall: scoreSchema,
  criteria: ratingCriteriaScoresSchema.optional(),
});
export type SaveRatingInput = z.infer<typeof saveRatingSchema>;

export type RatingCriteriaResult = { ok: true; criteria: RatingCriteriaScores } | { ok: false; errors: FieldError[] };

/**
 * Checks a Rating's Criteria scores against the Job's current selection: every key must be one the
 * Job uses. A `null` (clear) for a Criterion the Job dropped is refused too, because a request only
 * addresses the current Criteria; old scores for dropped Criteria are carried over by the service, not
 * edited here. Returns the scores unchanged, or one error per bad key with the key as its path (the
 * service prefixes it, like the other validators).
 */
export function checkRatingCriteria(
  criteria: RatingCriteriaScores,
  selectedKeys: readonly string[],
): RatingCriteriaResult {
  const errors = Object.keys(criteria)
    .filter((key) => !selectedKeys.includes(key))
    .map(
      (key): FieldError => ({
        path: key,
        message: "This criterion isn't used for this job. Reload the page and try again.",
      }),
    );
  return errors.length > 0 ? { ok: false, errors } : { ok: true, criteria: { ...criteria } };
}

/** What `summariseRatings` reads of a Rating: the overall score and the Criteria scores. */
export interface RatingScores {
  overall: number;
  criteria: RatingCriteriaScores;
}

export interface RatingAverage {
  /** How many Members gave a score. */
  count: number;
  /** The mean of those scores, not rounded (the web shows one decimal). */
  average: number;
}

export interface RatingSummary {
  /** How many Members rated the Application. */
  count: number;
  /** The mean of the `overall` scores (Criteria play no part), or `null` with no Ratings. Not rounded. */
  average: number | null;
  /** Per Criterion, over the Members who scored it. A Criterion nobody scored is absent. */
  criteria: Partial<Record<RatingCriterionKey, RatingAverage>>;
}

/**
 * The Average rating of an Application and the average of each Criterion (GLOSSARY.md "Average
 * rating"). Rounding is for display, not here.
 */
export function summariseRatings(ratings: readonly RatingScores[]): RatingSummary {
  const totals: Partial<Record<RatingCriterionKey, { count: number; sum: number }>> = {};
  for (const rating of ratings) {
    for (const key of RATING_CRITERION_KEYS) {
      const score = rating.criteria[key];
      if (score === undefined || score === null) {
        continue;
      }
      const total = (totals[key] ??= { count: 0, sum: 0 });
      total.count += 1;
      total.sum += score;
    }
  }

  const criteria: RatingSummary['criteria'] = {};
  for (const key of RATING_CRITERION_KEYS) {
    const total = totals[key];
    if (total) {
      criteria[key] = { count: total.count, average: total.sum / total.count };
    }
  }

  const overallSum = ratings.reduce((sum, rating) => sum + rating.overall, 0);
  return {
    count: ratings.length,
    average: ratings.length > 0 ? overallSum / ratings.length : null,
    criteria,
  };
}
