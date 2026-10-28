# Ratings: review fixes

The code review ran against `feat/ratings` at `d60b699`. This note covers the nine findings it asked to fix (A to I): what was done, the options weighed, and the docs relied on. Each fix is its own commit on the review-fix branch, except E and F, which touch the same lines and share one. The owner's calls were left alone: git history and the `merge:` subjects, the two pickers staying separate (ticket 05), and the unrated board card showing nothing instead of "No ratings".

Test seams: the repo's usual ones, the service through its public methods against an in-memory fake repository (`apps/api/src/pipeline/pipeline.rating.spec.ts`, `pipeline.board.spec.ts`, `pipeline.detail.spec.ts`) and the shared pure functions. No new spec was written: A and I are in the repository's SQL layer, which the fakes replace (see each), and C, D, E, F, G and H are refactors that the existing 400 API tests already pin (H through the `move` and `rate` specs). The web has no test runner, so D, E, F and G were checked with `tsc` and ESLint only, not in a browser.

## A. `saveRating` read the caller's Rating without `companyId`

- **Done:** the in-transaction read is now `Rating.where({ companyId, applicationId, userId }).first()`, like every other tenant-owned read (`.claude/rules/api.md`, "Tenant isolation").
- **`conflictOn` stays as it was.** The ORM's `upsert` types `conflictOn` as a `UniqueConstraintCriterion`: the columns of one unique constraint, here (`application_id`, `user_id`) (`orm-client.d.mts` in `@prisma/orm-family-sql`, the `upsert` JSDoc: "`conflictOn` selects which unique constraint drives the conflict resolution"). The key is global, and an Application id belongs to exactly one company, which the service has already checked. Adding `companyId` to it would invent a constraint the table does not have. The code has a comment saying this.
- **No spec, on purpose.** I could not write one that proves anything. Two companies cannot both hold a Rating for the same (application, user): that pair is the UNIQUE key, so the "other company's row" would be the very row the upsert updates. A fake that filters on `companyId` would only test the fake. The real repository's SQL is checked by hand against the dev database in earlier tickets; this was not re-run against a live database.

## B. The `ratings` index description did not match the contract

- **What is true** (checked with `docker exec farraza-db-1 psql -U hiring -d hiring -c "\d ratings"`, `contract.prisma` and `contract.json`): `contract.prisma` has no `@@index` on `Rating`, as the reviewer found. The table nevertheless has `ratings_application_id_idx_e32e1f6e` and `ratings_user_id_idx_6c952402`: `prisma contract emit` generates a non-unique index for each FK column and writes them to `contract.json` (`storage.tables.ratings.indexes`), which `db update` applies. The `(application_id)` one duplicates the leading column of the UNIQUE `ratings_application_id_user_id_key`, so the UNIQUE alone would serve the board's grouped read. Ticket 03's Answer (item 7) already said "Prisma added" both; the spec text "An index on (application_id)" is what read as a missing declaration.
- **Done (docs only):** `docs/db-schema.md` §3.16 and the spec's Further Notes (the "Database shape details" bullet) now say: no `@@index` is declared, the two indexes come from the FK auto-indexing, with their real names, and the first is redundant with the UNIQUE.
- **Not done:** no schema change, no `prisma db update`. Dropping the redundant index would need the emit to stop generating it, and I found no switch for that; if the owner wants it gone, that is a schema decision (`prisma contract emit --help`, `prisma db update --help`). `prisma db update --dry-run` plans 0 operations (final run below).

## C. `FORMER_MEMBER_NAME` and `mergeCriteria` placement

- **`FORMER_MEMBER_NAME`:** superseded by F. It left `pipeline.service.ts` for `@repo/shared` (`ratings.ts`), not for `pipeline.ts`, because the web needs the same string; one constant in `pipeline.ts` would leave the web's copy.
- **`mergeCriteria`: not moved, on purpose.** `.claude/rules/api.md` says the `<feature>.ts` files hold "domain interfaces and constants", and none of them (`job.ts`, `company.ts`, `form.ts`, `application.ts`, `pipeline.ts`) holds a function. Module-private helper functions sit in the service that uses them (`applications.service.ts`: `wantedFiles`, `fileConflict`, `fieldErrors`), which is where `mergeCriteria` already was. The alternative (a pure function in `pipeline.ts`) would be the first function in a `<feature>.ts`. Left as the existing pattern.

## D. The "Mirrors ApplicationDetail" comment sat above `RatingView`

- **Done:** `RatingView` (with its own doc comment) is first, and the "Mirrors ApplicationDetail in apps/api/src/pipeline/pipeline.ts (dates as ISO strings)" comment now sits directly above `ApplicationDetailView` in `apps/web/lib/dal.ts`.

## E. The `{ overall, criteria }` shape was declared five times

- **Done:** `RatingValues = { overall: number; criteria: Record<string, number> }` is now exported from `@repo/shared` (`ratings.ts`) and used by: the API's `RatingView` and `RatingRow` (both `extends RatingValues`), `SavedRating`, the repository and the rating spec (their local `RatingValues` import is gone); the web's `RatingView` in `dal.ts`, `Scores` in `activity-items.ts` (now `RatingValues`), `OwnRating` and the `saved` prop in `rating-control.tsx`.
- **Why not `RatingScores`:** it does not fit. Its `criteria` is `Partial<Record<RatingCriterionKey, number | null>>`, which admits `null` and forces every web reader to handle it, and ticket 03's Answer (item 2) records that the interface fails to type-check as the `rated` event's JSON. A stored or returned Rating never has a `null` score.
- **Decision for the owner:** this moved `RatingValues` out of `apps/api/src/pipeline/pipeline.ts` (where ticket 03 put it) into the shared package, as a new export. It stays a `type`, not an `interface`, for the same JSON reason, and the comment on it says so. Alternative: keep the API's own copy and only unify the web, which leaves two definitions that must agree. `RatingValues` is assignable to `RatingScores`, so `summariseRatings` still takes it.

## F. Magic values

- **Done:** `RATING_MAX` replaces the literal 5 in `activity-items.ts` ("rated 4 out of 5") and in `candidate-ratings.tsx` (both sr-only "out of 5" texts). `FORMER_MEMBER_NAME` is exported from `@repo/shared` (`ratings.ts`) and used by `pipeline.service.ts`, and by `activity-items.ts` in both its places (a rater with no Rating row, and a Note with no author name).
- **Docs:** `.claude/rules/api.md` (the `@repo/shared` Ratings paragraph) lists both exports. Neither `api.md` nor `web.md` has a rule about where shared constants go; `@repo/shared` already holds `HIGHLIGHT_LIMIT`, `RATING_MAX` and the like.
- **Left alone:** the visible "of 5" is not printed anywhere else; the stars and the one-decimal average do not hard-code 5.

## G. `CriterionRow` was a middle man

- **Done:** `CriterionRow` is deleted; `RatingControl` renders `ScoreRow` for each Criterion, and `ScoreRow` calls `useId()` for its own label id, so the overall row lost its `labelId` prop and `overallLabelId` too. Same DOM, same props, same ids (one per row). React's rule: a hook may be called in a component, and `ScoreRow` is one (https://react.dev/reference/react/useId).

## H. `move` and `rate` repeated the stage lookup

- **Done:** a private `PipelineService.currentStageOf(membership, job, applicationId)` runs `findStageOf`, finds the Stage in `job.stages` and throws `NotFoundException` for either miss. `move` and `rate` use it. `addNote` is unchanged (it needs only the existence check, not the Stage).
- **Behaviour:** identical. In `move` the old order was "no stage: 404, same stage: 409, stage not in the job: 404"; now the last 404 can come before the 409, but a Stage that the Job lacks can never equal the target (which was found in `job.stages`), so no request sees a different answer. The existing `move` and `rate` specs pass unchanged.

## I. `row.average ?? 0`

- **Done:** `findRatingSummaries` throws `Error('Rating group for application <id> has no average.')` when a grouped row has a `null` average.
- **Options:** (a) throw, chosen: the case cannot happen (`GROUP BY` yields a group only from at least one row, and `avg` of `int2` is null only for none), so if it ever does, a 500 beats a board that shows a made-up 0. (b) filter such rows out: an Application would then read as unrated, which is also a made-up answer. (c) widen the return type to `average: number | null`: the caller and the card type already assume a number when a Rating exists.
- **No spec:** the fake repository computes averages itself and cannot produce a null group.

## Files touched

- `apps/api/src/pipeline/pipeline.repository.ts`: the Rating read takes `companyId` (A); `findRatingSummaries` throws on a null average (I); `RatingValues` now comes from `@repo/shared` (E).
- `apps/api/src/pipeline/pipeline.service.ts`: `currentStageOf` for `move` and `rate` (H); `FORMER_MEMBER_NAME` imported from `@repo/shared` (F).
- `apps/api/src/pipeline/pipeline.ts`: `RatingValues` removed (now shared); `RatingView` and `RatingRow` extend it (E).
- `apps/api/src/pipeline/pipeline.rating.spec.ts`: `RatingValues` imported from `@repo/shared` (E).
- `packages/shared/src/ratings.ts`: exports `FORMER_MEMBER_NAME` and `RatingValues` (E, F).
- `apps/web/lib/dal.ts`: comment moved back to `ApplicationDetailView` (D); `RatingView extends RatingValues` and the wording of its comment (E).
- `apps/web/components/dashboard/candidates/activity-items.ts`: `RatingValues`, `RATING_MAX`, `FORMER_MEMBER_NAME` (E, F).
- `apps/web/components/dashboard/candidates/candidate-ratings.tsx`: `RATING_MAX` in the two sr-only texts (F).
- `apps/web/components/dashboard/candidates/rating-control.tsx`: `CriterionRow` removed, `ScoreRow` owns its id (G); `RatingValues` for `OwnRating` and `saved` (E).
- `docs/db-schema.md`: §3.16 states where the `ratings` indexes come from (B).
- `.scratch/ratings/spec.md`: the Further Notes line on the indexes (B).
- `.claude/rules/api.md`: the Pipeline "Rate" bullet (`currentStageOf`, the company-filtered read) and the `@repo/shared` Ratings paragraph (`FORMER_MEMBER_NAME`, `RatingValues`).
- `.scratch/ratings/review-fixes.md`: this note.
