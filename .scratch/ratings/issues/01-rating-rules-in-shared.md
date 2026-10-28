# 01: Rating rules and the Criteria catalog in `@repo/shared`

**What to build:** The pure rules every other ticket runs: the Criteria catalog, the 1–5 rule, the request schemas, the check of a Rating's Criteria against a Job's selection, and the average. No API, database or UI. Spec: `.scratch/ratings/spec.md` ("Concept and rules").

- **Catalog:** a new file next to `packages/shared/src/preset-keys.ts` (for example `rating-criteria.ts`) with `RATING_CRITERIA` (`technical_skills`, `problem_solving`, `communication`, `culture_fit`, `leadership`, `relevant_experience`, each with a label), `RATING_CRITERIA_LIMIT = 5`, `RATING_MIN = 1`, `RATING_MAX = 5`, and the key type. Append-only, with a header comment saying so (copy the reasoning from `preset-keys.ts`).
- **Schemas:** `ratingCriteriaKeysSchema` (at most five unique catalog keys), `saveRatingCriteriaSchema` (`z.strictObject({ keys })`), and `saveRatingSchema` (`overall` an integer 1–5; optional `criteria` object of catalog key to an integer 1–5 or `null`; strict). Export the inferred input types and re-export from the package index like the other schemas.
- **Selection check:** a pure function taking a Rating's criteria and the Job's selected keys and returning `<path>` errors (the same `{ ok, errors: [{ path, message }] }` shape as `checkHighlightKeys`) for a key not in the selection.
- **Summary:** `summariseRatings(ratings)` returning `{ count, average, criteria }` as in the spec; `average` is `null` with no ratings; no rounding.

Read `packages/shared/node_modules/zod/README.md` and `v4/classic/schemas.d.ts` for the Zod 4 API before writing schemas; rebuild with `pnpm --filter @repo/shared build` before the API can import it.

**Blocked by:** none.

**Status:** ready-for-agent

- [ ] The catalog has exactly the six keys, the limit and the range constants
- [ ] The criteria-keys schema accepts a valid list and refuses over five, duplicates and unknown keys
- [ ] The save-rating schema accepts 1 and 5, refuses 0, 6, 3.5 and non-numbers, accepts `null` for a Criterion, and refuses unknown keys
- [ ] The selection check names each key not in the Job's selection
- [ ] `summariseRatings`: no ratings is `{ count: 0, average: null }`; the overall average ignores Criteria; a Criterion averages only the Members who scored it; an unscored Criterion is absent
- [ ] Tests in `packages/shared` (`pnpm --filter @repo/shared test`), including one that pins the exact catalog keys
- [ ] `.claude/rules/api.md` `@repo/shared` section updated
- [ ] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer
