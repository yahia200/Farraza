# 03: A Member rates an Application

**What to build:** A Member can give or change their own Rating on an Application through the API, with the change recorded in the Application's history. No read endpoints or UI yet. Spec: `.scratch/ratings/spec.md` ("Database: ratings", "API: Rate", "History rule", "Event").

- **Table:** a new `Rating` model (`ratings`) as in the spec: `application_id` FK with cascade, nullable `user_id` FK with SET NULL, `overall` smallint CHECK 1 to 5, `criteria` jsonb object (default `'{}'`, CHECK it is an object), UNIQUE (`application_id`, `user_id`). Add `rated` to `ApplicationEventType`. Run the contract workflow with `--dry-run` first and commit the generated files.
- **Route:** `PUT companies/:companySlug/jobs/:jobSlug/applications/:applicationId/rating` with `{ overall, criteria? }` in the pipeline module, validated by `saveRatingSchema`. A new `ApplicationPolicy` action `rate` allows all four roles. The caller's own Rating only (user from the session).
- **Rules:** any Application status; the Application must be this company's and this Job's (404); Criteria scores must be in the Job's current selection (400 with `errors` paths, from the shared check); scores for Criteria the Job no longer uses are carried over from the existing Rating unchanged; `null` for a selected Criterion clears just that score.
- **Write:** in one transaction, upsert the Rating (`.upsert({ create, update, conflictOn })`) and write a `rated` `ApplicationEvent` with `{ previous, current, stage }` (previous read in the same transaction, `null` on a first rating; stage is the Application's current Stage name). A unique-violation race on a first rating becomes a 409 via `isUniqueViolation()`.
- **Answer:** the saved Rating `{ overall, criteria, updatedAt }`.

The spec's "Confirmed details" items 1-4 (names, last-write-wins upsert, clearable Criterion scores, stage name in the event) were accepted by the owner as written.

**Blocked by:** 01, 02.

**Status:** ready-for-agent

- [ ] The table, constraints and event type exist; contract files and snapshots committed
- [ ] Owner, admin, recruiter and interviewer can all rate
- [ ] A first rating creates one row and a `rated` event with `previous: null`; a second replaces the row and the event carries old and new values and the stage name
- [ ] Rating a Rejected, Hired or Withdrawn Application works
- [ ] A score for a Criterion outside the Job's selection is 400; `overall` outside 1–5 is 400
- [ ] A dropped Criterion's old score survives a re-rate; `null` clears only the named Criterion
- [ ] Two Members rating the same Application get two rows; a Member can't rate as someone else
- [ ] Another company's or another job's Application is 404
- [ ] Service specs on the in-memory fake repository (`src/pipeline` specs) for every case above
- [ ] `docs/db-schema.md` updated: new `ratings` section, the event type (§3.10, §4.3), rules (§7)
- [ ] `.claude/rules/api.md` updated for the pipeline module
- [ ] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer
