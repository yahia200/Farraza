# 05: Edit limit locks Requirements

**What to build:** Once a Job holds 100 Applications (the **Edit limit**), its Requirements can no longer be changed. The save is refused with a plain explanation, the Job says it is locked, and the Settings tab shows the list read-only with the reason. Below the limit everything works as before. Spec: `.scratch/candidate-matching/layer3-spec.md` ("The Edit limit"); glossary: **Edit limit**.

- One constant for every Job (100). Every Application counts, rejected ones included, so the count never goes down. It becomes a per-Job value when tiers arrive (see the backlog item "Job tiers and the Application limit").
- The Requirements save returns a conflict with a message saying why, for any role. Nothing is written.
- The Job payload carries whether the Requirements are locked. Jobs already past the limit are locked as soon as this ships.
- The Settings tab disables editing and shows the reason; the Re-check button still works below and above the limit for Applications that are behind.
- The Layer 2 spec (stories 7 and 8, "edit on any Job status") gets a short note that the Edit limit now bounds them.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] A service spec shows a save is allowed at 99 Applications and refused at 100, and that a rejected Application counts
- [x] A refused save writes no version and leaves the stored list untouched
- [x] The Job payload's locked flag is correct on both sides of the limit, and no public payload carries it
- [ ] The Settings tab shows the read-only list and the reason, checked in a browser on a Job at the limit
- [x] `docs/db-schema.md` or the API rules mention the limit where Requirements are described
- [x] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass

## Answer

Commit: see `git log` on branch `worktree-agent-aa3abc85afd2a687f` (subject `feat(jobs): lock Requirements at the Edit limit`).

Decisions:
- `REQUIREMENT_EDIT_LIMIT = 100` lives in its own file `packages/shared/src/requirement-edit-limit.ts` (one export line in `index.ts`) so it does not collide with the scoring constants or the optional-keywords edits to `requirements.ts`.
- `JobsService.saveRequirements` counts Applications (`JobsRepository.countApplications`, an unfiltered `count(*)` by company and Job, so rejected ones count) before comparing lists, and throws a 409 `ConflictException`. An unchanged list is refused too (simplest rule; the locked editor cannot send one anyway). The role check runs first, so an interviewer still gets 403.
- The flag is on the single-Job payload only: new `JobsService.getDetail` returns `JobDetail` (`JobWithStages` plus `requirementsLocked`) and the controller's `GET :jobSlug` uses it. `get` (shared by a dozen services) is unchanged, so it runs no extra count and no other payload carries the flag. `POST` create and the list do not carry it.
- No public payload carries it: `getPublicJob` builds its answer field by field, and the existing spec "returns no Requirements, results or marker from the public job payload" (regex `/requirement/i` on the JSON) covers a `requirementsLocked` key.
- Web: `getJob` returns `requirementsLocked` (`LoadedJob`, not `CompanyJob`); the editor takes `locked`, disables every control and shows a status Alert with the reason; Re-check stays usable.

Open items:
- The browser box is unticked: needs the owner (seed or submit 100 Applications on a Job, open its Settings tab, check the Alert, the read-only list, a working Re-check button, and that a PUT returns 409).
- Count and insert are not one transaction, so a save racing the 100th submit can land; judged acceptable for a cost bound (noted in the service, the db schema doc and api.md).
- The real `countApplications` query is not covered by a spec (fake repository); it is a plain `aggregate(count)` copied from `PrismaMfaStore.countRecoveryCodes`.
