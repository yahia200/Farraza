# 01: Rating rules and the Criteria catalog in `@repo/shared`

**What to build:** The pure rules every other ticket runs: the Criteria catalog, the 1–5 rule, the request schemas, the check of a Rating's Criteria against a Job's selection, and the average. No API, database or UI. Spec: `.scratch/ratings/spec.md` ("Concept and rules").

- **Catalog:** a new file next to `packages/shared/src/preset-keys.ts` (for example `rating-criteria.ts`) with `RATING_CRITERIA` (`technical_skills`, `problem_solving`, `communication`, `culture_fit`, `leadership`, `relevant_experience`, each with a label), `RATING_CRITERIA_LIMIT = 5`, `RATING_MIN = 1`, `RATING_MAX = 5`, and the key type. Append-only, with a header comment saying so (copy the reasoning from `preset-keys.ts`).
- **Schemas:** `ratingCriteriaKeysSchema` (at most five unique catalog keys), `saveRatingCriteriaSchema` (`z.strictObject({ keys })`), and `saveRatingSchema` (`overall` an integer 1–5; optional `criteria` object of catalog key to an integer 1–5 or `null`; strict). Export the inferred input types and re-export from the package index like the other schemas.
- **Selection check:** a pure function taking a Rating's criteria and the Job's selected keys and returning `<path>` errors (the same `{ ok, errors: [{ path, message }] }` shape as `checkHighlightKeys`) for a key not in the selection.
- **Summary:** `summariseRatings(ratings)` returning `{ count, average, criteria }` as in the spec; `average` is `null` with no ratings; no rounding.

Read `packages/shared/node_modules/zod/README.md` and `v4/classic/schemas.d.ts` for the Zod 4 API before writing schemas; rebuild with `pnpm --filter @repo/shared build` before the API can import it.

**Blocked by:** none.

**Status:** resolved

- [x] The catalog has exactly the six keys, the limit and the range constants
- [x] The criteria-keys schema accepts a valid list and refuses over five, duplicates and unknown keys
- [x] The save-rating schema accepts 1 and 5, refuses 0, 6, 3.5 and non-numbers, accepts `null` for a Criterion, and refuses unknown keys
- [x] The selection check names each key not in the Job's selection
- [x] `summariseRatings`: no ratings is `{ count: 0, average: null }`; the overall average ignores Criteria; a Criterion averages only the Members who scored it; an unscored Criterion is absent
- [x] Tests in `packages/shared` (`pnpm --filter @repo/shared test`), including one that pins the exact catalog keys
- [x] `.claude/rules/api.md` `@repo/shared` section updated
- [x] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer

Built test-first through the public functions (one test, then the minimum code, per slice; seams: the catalog constants, the two schemas, `checkRatingCriteria`, `summariseRatings`). `@repo/shared` build, 458 tests, `pnpm lint` (0 errors; 2 existing web warnings) and `pnpm check-types` pass.

**Exports** (all re-exported from `packages/shared/src/index.ts`)

`rating-criteria.ts`:
- `RATING_MIN = 1`, `RATING_MAX = 5`, `RATING_CRITERIA_LIMIT = 5`
- `RATING_CRITERIA`: `readonly [{ key, label }, ...]` as const, in the spec's order (`technical_skills` "Technical skills", `problem_solving` "Problem solving", `communication` "Communication", `culture_fit` "Culture fit", `leadership` "Leadership", `relevant_experience` "Relevant experience")
- `type RatingCriterionKey`, `RATING_CRITERION_KEYS` (the keys as a non-empty tuple, for `z.enum`)
- `ratingCriteriaKeysSchema`: `z.array(z.enum(keys))`, `.max(5)`, no repeats

`jobs.ts`: `saveRatingCriteriaSchema = z.strictObject({ keys: ratingCriteriaKeysSchema })`, `type SaveRatingCriteriaInput` (next to `saveHighlightedQuestionsSchema`).

`ratings.ts`:
- `ratingCriteriaScoresSchema` / `type RatingCriteriaScores` (`Partial<Record<RatingCriterionKey, number | null>>`)
- `saveRatingSchema = z.strictObject({ overall, criteria? })` / `type SaveRatingInput`
- `checkRatingCriteria(criteria: RatingCriteriaScores, selectedKeys: readonly string[]): RatingCriteriaResult` where `RatingCriteriaResult = { ok: true; criteria } | { ok: false; errors: FieldError[] }`
- `summariseRatings(ratings: readonly RatingScores[]): RatingSummary`, with `RatingScores = { overall: number; criteria: RatingCriteriaScores }`, `RatingSummary = { count; average: number | null; criteria: Partial<Record<RatingCriterionKey, { count; average }>> }`, `RatingAverage`

**Choices**

- *Where the code lives.* Catalog, limits and the keys schema in a new `rating-criteria.ts`; the rating body, the selection check and the summary in a new `ratings.ts`; the request body for the Job's Criteria in `jobs.ts`, copying how `highlights.ts` holds the rules and `jobs.ts` holds `saveHighlightedQuestionsSchema`. Rejected: everything in one file (the keys schema is needed by `jobs.ts`, and `ratings.ts` imports the catalog, so one file would make `jobs.ts` import a file about ratings); `saveRatingSchema` in `applications.ts` (that file is the apply form; ratings code stays together).
- *Scores.* `z.int().min(1).max(5)` (Zod 4's safe-integer schema, so `3.5`, `NaN` and `Infinity` fail without extra checks). Docs: `packages/shared/node_modules/zod/v4/classic/schemas.d.ts` (`int`, line 347). Rejected: `z.number().int()`, which I did not check against the installed `.d.ts`, so I kept to the top-level `z.int()` I had read.
- *Criteria scores object.* `z.partialRecord(z.enum(keys), score.nullable())`. In Zod 4 `z.record` with an enum key type is exhaustive (every key required), and a rater may skip any Criterion, so `partialRecord` is the right one (`schemas.d.ts` lines 534-536, and `$InferZodRecordInput` at `v4/core/schemas.d.ts` line 746-747 for the `Partial` type; the README has no section on it, so this comes from the `.d.ts` and the tests that pin it: a key outside the catalog is refused, an absent key is fine). Rejected: `z.strictObject` built from the six keys (it would have to be rebuilt by hand whenever the catalog grows) and `z.record(z.string(), ...)` (accepts unknown keys).
- *Messages.* Unknown or malformed keys and repeats use `RELOAD_MESSAGE` (like the highlight keys: a stale page or a hand-made request, never user typing); the limit says "Choose up to 5 criteria."; a bad score says "Choose a rating from 1 to 5."
- *Selection check.* Named `checkRatingCriteria`, same `{ ok, errors: [{ path, message }] }` shape as `checkHighlightKeys` (the ok branch carries `criteria` unchanged, as that one carries `keys`). The error `path` is the Criterion key (like `<index>` there), and the service adds the `criteria.` prefix, as `saveHighlightedQuestions` adds `keys.`. A `null` (clear) for a Criterion the Job does not use is **refused too**: the request only addresses the Job's current Criteria (spec, "History rule for dropped Criteria"), so there is no way to edit a dropped Criterion's old score. Rejected: letting `null` through for a dropped Criterion (it would be a quiet way to delete history the spec says to keep).
- *Summary.* `summariseRatings({ count: 0 })` returns `{ count: 0, average: null, criteria: {} }`. A Criterion is present only if at least one Member gave it a number; `null` and absent both mean "did not score". No rounding. It reads the six catalog keys only, so a stray key in stored data cannot appear in the summary.

**For tickets 02, 03, 04 and 07**

- Ticket 02 (Job stores its Criteria): body is `saveRatingCriteriaSchema` (controller `@Body({ schema: saveRatingCriteriaSchema })`), the stored value is `string[]` of catalog keys. Unlike highlights there is no form to check against: the schema is the whole validation, so a bad key or more than five is already a 400 from the pipe with path `keys` or `keys.<index>` (the repeat error's path is the index of the second copy).
- Ticket 03 (rate): body is `saveRatingSchema`; after it, call `checkRatingCriteria(dto.criteria ?? {}, job.ratingCriteria)` and map `errors` to 400 `{ message, errors: [{ path: 'criteria.<key>' }] }` (prefix each path). Merge rule for the stored `criteria`: start from the Member's existing criteria, drop keys the request sends as `null`, set the numbers the request sends, leave every other key (this is how dropped Criteria survive). `overall` is always required, so a re-rate always resends it.
- Ticket 03 stores `criteria` as `Partial<Record<RatingCriterionKey, number>>` (no `null` values stored: a cleared score is removed), so the `RatingCriteriaScores` type is a superset of what is stored and can be passed to `summariseRatings` as is.
- Tickets 04 and 07: feed `summariseRatings` the Ratings as `{ overall, criteria }` rows (extra fields are fine). The board card needs only `count` and `average`, which the spec has computed in SQL by grouping on the Application id; keep that grouped query as the spec says and use `summariseRatings` for the detail payload, so the two agree on "mean of `overall`, `null` for none, unrounded".
- The web can import `RATING_CRITERIA` for labels and `RATING_MIN`/`RATING_MAX` for the buttons (`Array.from({ length: RATING_MAX - RATING_MIN + 1 }, ...)`).
- Rebuild before the API sees it: `pnpm --filter @repo/shared build`.
