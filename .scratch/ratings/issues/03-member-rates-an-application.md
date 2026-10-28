# 03: A Member rates an Application

**What to build:** A Member can give or change their own Rating on an Application through the API, with the change recorded in the Application's history. No read endpoints or UI yet. Spec: `.scratch/ratings/spec.md` ("Database: ratings", "API: Rate", "History rule", "Event").

- **Table:** a new `Rating` model (`ratings`) as in the spec: `application_id` FK with cascade, nullable `user_id` FK with SET NULL, `overall` smallint CHECK 1 to 5, `criteria` jsonb object (default `'{}'`, CHECK it is an object), UNIQUE (`application_id`, `user_id`). Add `rated` to `ApplicationEventType`. Run the contract workflow with `--dry-run` first and commit the generated files.
- **Route:** `PUT companies/:companySlug/jobs/:jobSlug/applications/:applicationId/rating` with `{ overall, criteria? }` in the pipeline module, validated by `saveRatingSchema`. A new `ApplicationPolicy` action `rate` allows all four roles. The caller's own Rating only (user from the session).
- **Rules:** any Application status; the Application must be this company's and this Job's (404); Criteria scores must be in the Job's current selection (400 with `errors` paths, from the shared check); scores for Criteria the Job no longer uses are carried over from the existing Rating unchanged; `null` for a selected Criterion clears just that score.
- **Write:** in one transaction, upsert the Rating (`.upsert({ create, update, conflictOn })`) and write a `rated` `ApplicationEvent` with `{ previous, current, stage }` (previous read in the same transaction, `null` on a first rating; stage is the Application's current Stage name). A unique-violation race on a first rating becomes a 409 via `isUniqueViolation()`.
- **Answer:** the saved Rating `{ overall, criteria, updatedAt }`.

The spec's "Confirmed details" items 1-4 (names, last-write-wins upsert, clearable Criterion scores, stage name in the event) were accepted by the owner as written.

**Blocked by:** 01, 02.

**Status:** resolved

- [x] The table, constraints and event type exist; contract files and snapshots committed
- [x] Owner, admin, recruiter and interviewer can all rate
- [x] A first rating creates one row and a `rated` event with `previous: null`; a second replaces the row and the event carries old and new values and the stage name
- [x] Rating a Rejected, Hired or Withdrawn Application works
- [x] A score for a Criterion outside the Job's selection is 400; `overall` outside 1–5 is 400
- [x] A dropped Criterion's old score survives a re-rate; `null` clears only the named Criterion
- [x] Two Members rating the same Application get two rows; a Member can't rate as someone else
- [x] Another company's or another job's Application is 404
- [x] Service specs on the in-memory fake repository (`src/pipeline` specs) for every case above
- [x] `docs/db-schema.md` updated: new `ratings` section, the event type (§3.10, §4.3), rules (§7)
- [x] `.claude/rules/api.md` updated for the pipeline module
- [x] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer

Built test-first through `PipelineService.rate`: the real service and the real `ApplicationPolicy` (via `AuthorizationModule.forRoot()`, the `jobs.service.spec.ts` pattern, because the existing pipeline specs stub `authorize`) on an in-memory fake repository. Seams: `PipelineService.rate` and the request body through the real `StandardSchemaValidationPipe`; I proposed no others. Slice 1 (a first rating) went red (`service.rate is not a function`), then the minimum code; the second slice (criteria check, merge, 409) went red on 8 of 28 and then green. The remaining cases (roles, statuses, 404s, two Members) passed at once because they follow from slice 1 (the policy returns true, the lookups are `findStageOf`); they stay as guards. `pipeline.rating.spec.ts`: 28 tests.

### The four things the notes flagged as unverified

- **(a) `rated` in the CHECK.** Adding `Rated = "rated"` to the `ApplicationEventType` enum in `contract.prisma` makes `prisma db update --dry-run` plan **8 operations, all mine and nothing from other worktrees**: *drop* check constraint `application_events_type_check_390670b3` (classed `destructive`), create table `ratings`, *add* check `application_events_type_check_f13f5dd1` (`type IN ('applied', 'auto_rejected', 'stage_changed', 'rejected', 'hired', 'withdrawn', 'note_added', 'rated')`), the unique `ratings_application_id_user_id_key`, indexes `ratings_application_id_idx_e32e1f6e` and `ratings_user_id_idx_6c952402`, and two FKs (`ratings_application_id_fkey` CASCADE, `ratings_user_id_fkey` SET NULL). So the CHECK is **replaced** (drop then add, the hash in its name changes), not altered in place. The drop is "destructive" only in the planner's vocabulary: it removes a constraint, no data, and the new one is wider. Because of that class, a plain `prisma db update` asks to type the database name; I ran `prisma db update --no-interactive --confirm hiring` (flags from `prisma db update --help`). All 8 operations executed. I then confirmed in the dev DB with `psql`: the table, the single `application_events` CHECK now listing `rated`, and that an `overall` of 6 and a `criteria` of `'[]'` are each refused by their CHECKs.
- **(b) `smallint`.** Written `SmallInt` in type position (`overall SmallInt`). Source: `apps/api/.claude/skills/prisma-8/upgrading/app/upgrades/0.16-to-0.17/instructions.md` line 219 (the `@db.SmallInt` to `SmallInt` translation, "authored directly in PSL type position"). `apps/api/prisma-8.md` itself does not mention it. `contract emit` accepted it and the table has `overall smallint`. In the generated types it is `pg/int2@1`, which reads back as a JS `number`.
- **(c) `updatedAt` on the upsert update branch.** Yes, the ORM sets it, **provided `update` has at least one value**. Source: `.pnpm/@prisma+orm-family-sql@8.0._7ab…/node_modules/@prisma/orm-family-sql/dist/orm-client.mjs`, `upsert()` (~line 4696-4704): `if (hasUpdateValues) applyUpdateDefaults(...)`. Our `update` always carries `overall` and `criteria`, so I did not set it by hand. Checked live: a throwaway script (scratchpad, not committed) called `PipelineRepository.saveRating` twice against the dev DB; the second `updatedAt` was later than the first, `previous` came back as the first row, and both events were right. The script deleted its rating and events afterwards (counts back to 0). Note `updated_at` has **no DB default** (an insert that bypasses the ORM fails NOT NULL, as §1 of `docs/db-schema.md` already says).
- **(d) `.upsert` signature.** From `orm-client.d.mts` (~line 1354): `upsert(input: { create: ResolvedScalarCreateInput; update: Partial<DefaultModelRow>; conflictOn?: UniqueConstraintCriterion }, configure?): Promise<Row>`, returning the inserted or updated row. With `conflictOn` omitted it uses the primary key, so it is required here: `conflictOn: { applicationId, userId }`, which matches the model's `@@unique([applicationId, userId])`. The conflict columns must be present in `create`. It compiles to `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`.

### Choices (owner may want to review)

1. **Where the transaction and the rules live: `saveRating(input)` takes a `resolve(previous)` callback.** The merge needs the Member's current row, and the spec wants `previous` read in the same transaction as the write. Options: (A) the service reads, merges, then calls the repository: two transactions, so a concurrent save could lose a carried-over score and `previous` would not be the same read the write replaced; (B) the repository does the merge: the rules would sit in the repository (the earlier "Rejected: repository returning rows with rules already resolved" choice); (C, chosen) the service passes a pure `resolve(previous) => values` into one repository transaction, so the rules (`mergeCriteria`, a private function in `pipeline.service.ts`) stay in the service, the read and write are one transaction, and the in-memory fake calls the same callback. Docs: none for the pattern; it is an app design choice. The only library call is `transaction(async (tx) => ...)`, as `move` and `addNote` already do.
2. **Value type `RatingValues = { overall; criteria: Record<string, number> }` (a `type`, not an interface), in `pipeline/pipeline.ts`.** The first draft used `@repo/shared`'s `RatingScores`, and `tsc` refused it as the event's `data` ("Index signature for type 'string' is missing in `RatingScores`": an interface, or a `Partial<Record<..., number | null>>`, is not a `JsonValue`). A stored Rating never has `null` scores, so the narrower type is also the honest one. `RatingScores` is still the right input to `summariseRatings` (a `RatingValues` is assignable to it).
3. **The 409.** `isUniqueViolation` is caught around `saveRating` and becomes a `ConflictException`, as the ticket and `.claude/rules/api.md` ask. Be aware it is **defensive**: an upsert is `ON CONFLICT`, so the (application, user) key cannot raise 23505 for itself, and a race on a first rating simply ends as two events, the second with `previous` pointing at the first (last-write-wins, the spec's "Confirmed details" 2). The test fakes the error to prove the mapping. The owner may prefer to drop the catch.
4. **Error shape for out-of-selection scores:** `BadRequestException({ message: 'Some criteria are not used for this job.', errors: [{ path: 'criteria.<key>', message }] })`, the shared check's key prefixed with `criteria.` as `saveHighlightedQuestions` prefixes `keys.`. The shared message ("This criterion isn't used for this job. Reload the page and try again.") is the per-error text.
5. **Policy:** `ApplicationPolicy.rate` returns `true` (all four roles), same shape as `addNote`. No web mirror in `members.ts` is needed.
6. **`stage` in the event** is the name of the Application's stage as read by `findStageOf` just before the transaction, looked up in `job.stages` (as `move` does). If someone moves the Application in the few milliseconds between, the name is one move stale; same last-write-wins trade as above. No extra column or query for it.
7. **Auto-generated indexes.** Prisma added `ratings_application_id_idx_e32e1f6e` (which duplicates the leading column of the UNIQUE) and `ratings_user_id_idx_6c952402` for the FKs, as it does for every FK. I left them; the first would serve the board's grouped read in ticket 04 if the UNIQUE's index were not enough, and nothing else needs removing.
8. **Contract syntax:** a `Rating` model after `Note`, with `@@unique([applicationId, userId])` and two `@@check`s, copied from `Note`, `Job` and `Candidate` in `contract.prisma`. No back-relation fields were added to `Application` or `User` (one-sided relations work, as for `Note`).
9. **Withdrawn.** The ticket lists Rejected, Hired and Withdrawn. No Stage kind produces a `withdrawn` status yet (the event is "not written yet"), so the spec tests Rejected and Hired; `rate` never reads the status, so a Withdrawn Application is rated the same way.

### Exact response shape

`PUT /api/companies/:companySlug/jobs/:jobSlug/applications/:applicationId/rating`, body `{ overall: 1..5, criteria?: { <catalogKey>: 1..5 | null } }` (strict: any other key, `userId` included, is a 400):

```json
{ "overall": 4, "criteria": { "communication": 5, "culture_fit": 3 }, "updatedAt": "2026-10-28T17:58:04.488Z" }
```

`criteria` holds only the scores now stored (no `null` values; it can include keys the Job no longer uses). HTTP 200 (Nest's default for `PUT`). Errors: 400 (body validation `overall` / `criteria.<key>` / unknown key; or a Criterion outside the Job's selection, with `errors[].path` `criteria.<key>`), 404 (unknown or other company's job; an Application that is not this company's and this job's; a non-UUID id), 409 (the unique-violation guard). Never 403: all roles may rate.

The `rated` event: an `application_events` row with `type: 'rated'`, `actorId` = the rater, no stage ids, `data: { previous: { overall, criteria } | null, current: { overall, criteria }, stage: '<stage name>' }`. One per save, even when nothing changed.

### For tickets 04, 06, 07

- **Ticket 04 (detail and board reads):** table `ratings` has `company_id`, `application_id`, `user_id` (nullable), `overall`, `criteria`, `created_at`, `updated_at`; model `db.orm.public.Rating`. Join the author with `.include('user')` (the relation is declared on `Rating`; `User` has no back-relation, as with `Note.author`) and map a null user to "Former member". Filter board reads by `companyId` and the Job's application ids (`applicationId IN (...)`; `Rating` has no `jobId`), and skip the query when the Job has no Applications. The stored `criteria` is a `Record<string, number>` (`toRatingValues` in `pipeline.repository.ts` is the cast; or feed `{ overall, criteria }` rows to `summariseRatings`). `ApplicationEventView.type` is `string`, so `rated` events already come through the detail's `events` list with `data` untouched; ticket 06's sheet must render `rated` events (no `fromStageName`/`toStageName`). A `groupBy('applicationId').aggregate(agg => ({ count: agg.count(), average: agg.avg('overall') }))` exists in the installed ORM types (`orm-client.d.mts` ~lines 863, 1031) and `avg` over `int2` is a nullable `number`; I did not run it.
- **Ticket 06 (sheet):** the save is a single `PUT`; send `overall` every time (it is required) and only the Criteria that changed (an omitted Criterion keeps its score; `null` clears it; a key not in `job.ratingCriteria` is a 400). The answer carries the full merged `criteria`, dropped Criteria included, which the sheet can use to refresh its own row. Revalidate the board and detail like the notes action.
- **Ticket 07 (card, table):** nothing from this ticket; the card's `rating` is ticket 04's.
- **Specs that build a fake `JobWithStages`** need `ratingCriteria` (the new spec does; `pipeline.board.spec.ts` got it in ticket 02). A spec of another pipeline method that wants "every role" needs the real policy, as `pipeline.rating.spec.ts` does.
- `PipelineRepository` gained `saveRating`; the existing fakes implement `Pick<...>` subsets, so nothing else changed.

### Docs relied on

`apps/api/.claude/skills/prisma-8/upgrading/app/upgrades/0.16-to-0.17/instructions.md` (the `SmallInt` type position), `prisma contract emit` and `prisma db update --help` (`--dry-run`, `--no-interactive --confirm <database>`), `orm-client.d.mts` and `orm-client.mjs` in `@prisma/orm-family-sql/dist` (`upsert`, `applyUpdateDefaults`), the generated `contract.d.ts`, and the existing `Note`/`Job`/`Candidate` lines in `contract.prisma`. Nest `Put` and `@Body({ schema })`, and `StandardSchemaValidationPipe`, follow the existing route and spec patterns (`PipelineController.addNote`, `jobs.service.spec.ts`); I did not re-open their `.d.ts` files this session, so for those I name the pattern, not freshly verified docs.

### Checks

- `pnpm lint`: 0 errors (10 existing API warnings and 2 existing web warnings, none in files this ticket touches). The API `tsc --noEmit` is clean. The final test runs, after merging `feat/ratings`, are in the hand-off report.
- **Dev DB changed:** yes (the new table plus the CHECK replacement above); the live smoke test left no rows (0 ratings, 0 `rated` events).

### Files

- Modified `apps/api/src/prisma/contract.prisma`: `Rated` event type and the `Rating` model with its constraints.
- Modified `apps/api/src/prisma/contract.json`, `apps/api/src/prisma/contract.d.ts`: regenerated by `prisma contract emit`.
- Modified `apps/api/migrations/app/refs/db.json`: the `db` ref advanced by `prisma db update`.
- Created `apps/api/migrations/snapshots/cbaa55ed…/` (`contract.json`, `contract.d.ts`): the snapshot `db update` writes.
- Created `apps/api/src/pipeline/dto/save-rating.dto.ts`: re-exports the shared body schema and declares the DTO type.
- Modified `apps/api/src/pipeline/application.policy.ts`: the `rate` action.
- Modified `apps/api/src/pipeline/pipeline.controller.ts`: the `PUT :applicationId/rating` route.
- Modified `apps/api/src/pipeline/pipeline.service.ts`: `rate` and the private `mergeCriteria`.
- Modified `apps/api/src/pipeline/pipeline.repository.ts`: `saveRating` (one transaction: read, upsert, event) and `toRatingValues`.
- Modified `apps/api/src/pipeline/pipeline.ts`: `RatingValues` and `SavedRating` types.
- Created `apps/api/src/pipeline/pipeline.rating.spec.ts`: the 28 service and request-body specs.
- Modified `docs/db-schema.md`: enum list, tenant note, new §3.16 `ratings`, §4.3 `rated` event, new §4.4 `ratings.criteria`, §5 relations, §7 rules, and a note that the planned `scores` table's overall part is now `ratings`.
- Modified `.claude/rules/api.md`: the interviewer role line, the concurrency exception, the Pipeline "Rate" bullet and the audit trail list.
- Modified `.scratch/ratings/issues/03-member-rates-an-application.md`: status, ticked boxes and this Answer.
