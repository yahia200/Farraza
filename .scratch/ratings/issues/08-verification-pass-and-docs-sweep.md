# 08: Verification pass and docs sweep

**What to build:** End-to-end check of the ratings feature in the running app and a final pass over the docs. Spec: `.scratch/ratings/spec.md` ("Testing Decisions", "Docs").

- **Browser check** (dev server): manager picks Criteria; two accounts (one interviewer) rate the same Application; change a rating and see it in the Application's history; clear a Criterion score; drop a Criterion and see its old scores marked; table shows and sorts by Average rating with an unrated candidate last; the board card matches; a Rejected Application can still be rated; a Rating survives when its author is removed from the company and shows the right name or "Former member"; the public apply page and its payload carry nothing about ratings. Record what was checked and what was not.
- **Docs sweep:** `docs/db-schema.md` (`jobs`, `ratings`, event type and data shape, no-FK list, rules), `.claude/rules/api.md`, `.claude/rules/web.md`, the `GLOSSARY.md` entries against what shipped (Rating, Criterion, Average rating, Application Event), and the CLAUDE.md docs table only if a new dependency was added (none expected).
- Run `pnpm lint`, `pnpm check-types`, `pnpm --filter api test` and `pnpm --filter @repo/shared test`.

**Blocked by:** 05, 06, 07.

**Status:** resolved

- [x] Every browser check above is done or listed as not done, with the reason
- [x] Docs match the shipped behaviour; any differences from the spec are written in the spec's follow-up notes
- [x] All four commands pass

## Comments

## Answer

Browser pass and docs sweep done. No code changed: no ratings bug found. Docs fixed in five places (below) and the spec's follow-up notes written (`## Further Notes` in `.scratch/ratings/spec.md`, which is now `resolved`).

### Browser check (own servers: API 3011, web 3010; ports 3000/3001 never touched)

Test data was created through the app's own API (sign-up, company, members, job, form, apply) and the UI: one company, one Job with a published one-question form, 4 users (an owner, two recruiters, an interviewer), 5 applicants. Two browser tabs with separate cookies (`localhost:3010` for the owner, `carol.localhost:3010` for the interviewer).

Checked:
- **Manager picks Criteria:** the owner ticked Technical skills, Communication and Culture fit in the popover (each tick saved: the Job read back those three keys). The interviewer's table had neither picker button nor the Close job button.
- **Two accounts, one an interviewer, rate the same Application:** the owner rated Ada 4 in the UI, a recruiter 5 (API) and the interviewer 3 in the UI. The interviewer's sheet listed all three by name, "(you)" on her own, first rater first (owner, recruiter, interviewer). The summary was 4.0 (3), then 4.3 (3) after the owner changed to 5.
- **Change a rating, history:** the owner changed 4 to 5 in the UI; the Activity list gained "Rtest Alice changed their rating from 4 to 5 (in Applied)". The first-rating, scored and cleared lines also read correctly from real events, and the API's events carried `{ previous, current, stage }`.
- **Clear a Criterion score:** Communication 3 saved, then pressed again: "cleared Communication" in the history and the key gone from the stored criteria.
- **Drop a Criterion:** unticked Culture fit in the picker: the open sheet showed its old score (2.0 (1) in the averages, and in the recruiter's row) with a "no longer used" badge and no control for it. A recruiter re-rating the overall through the API kept `culture_fit: 2`; sending `null` for it, or a score for an unselected Criterion, is a 400 with `criteria.<key>` paths; `overall` 6 and a `userId` in the body are 400.
- **"Criteria changed under an open sheet" 400:** the interviewer's sheet was open with Communication offered; the Job dropped it (API); she pressed Communication 4. The toast read "Couldn't save your rating / This job's rating criteria changed. Reload the page and try again.", nothing was saved, and the sheet re-rendered with the new Criteria (the action revalidated).
- **Table:** shows "4.5 (2)", "4.0 (3)", "2.0 (1)", "No ratings". Rating header click 1: ascending (Ben 2.0, Ada 4.0, Cleo 4.5, then the two unrated); click 2: descending (Cleo, Ada, Ben, then the two unrated still last). `aria-sort` matched.
- **Board card:** star plus "4.5 (2)" under the name on rated cards, nothing extra on the unrated card; also at 375px.
- **Card with a Highlighted question and a rating together** (ticket 07 could not): set the Highlighted question through the picker UI, then the board showed the rating line above the "Favourite language?" answer on the same card, at desktop width and at 375px.
- **Rejected Application can be rated:** moved Dev to Rejected, the interviewer rated it 2 in the UI; the sheet then showed 2.0 (1).
- **Removed Member / "Former member":** a recruiter rated, then was removed from the company: the Rating stayed, still counted (2.5 (2)) and kept his real name (his user row still existed). After deleting that user row in the dev DB (`user_id` became NULL): the sheet showed "Former member" in the list and "Former member rated 3 out of 5" in the history, and the average still counted him.
- **Public apply page and payload:** `GET /api/public/:company/:job`, `/api/public/:company` and `/api/public/:company/branding`, collected by key: none matches rating, criteri, average or overall. The web pages `/:company/:job` and `/:company` (HTML plus the Next flight data) hold no rating key (the only text matches were the words in my test company's name and description). The submit answers `{ received: true }`.
- **Light theme:** table and sheet looked right (emulated with `prefers-color-scheme`, which the app follows); the dropped-Criterion badge, the buttons and the averages read well.
- **Phone width (375x812):** board with a rated card plus a Highlighted answer: document width 375, no horizontal scroll. Sheet: 281px wide (94 to 375), the five buttons end at 320 inside a card ending at 359, button height 36px, document width 375.
- `prisma db update --dry-run`: 0 operations.

Not checked, and why:
- Two clicks racing, or two tabs rating for the first time at once (needs timing the pane can't give).
- A real screen reader and touch input (the pane sends mouse clicks); the keyboard path was checked in ticket 06 and not repeated.
- The light-theme picker popover and board (only the table and sheet were looked at).
- The "kept their rating at N" history line from a real event (the control does not send a no-change save).
- A `withdrawn` Application (no Stage kind produces it yet).
- The one-extra-query count for the board (done in ticket 07 with `pg_stat_user_tables`; not repeated).

### Differences from the spec and inconsistencies between tickets

All are in the spec's `## Further Notes`. Short list: the unrated card shows nothing; the table label has a star; Criterion rows are disabled until an overall exists; a `null` for a dropped Criterion is a 400; "Former member" only after the user row is deleted (leaving the company keeps the name); the 409 on a unique violation is defensive only; the board's grouped query is skipped (not run once) when the Job has no Applications, so ticket 07's text is the stale part and the code and docs agree; the stored Criteria order is catalog order because the picker sends it (`docs/db-schema.md` said "the order the manager picked them": fixed); the event CHECK was replaced, not altered.

### Bugs found

None in the ratings code. One unrelated console error: switching Table/Board client-side logs "`NaN` is an invalid value for the `left` css style property" once; it did not appear on fresh loads of the table, board or sheet. Not traced (likely the view toggle's highlight animation, which predates ratings). `candidate-card.tsx:10` has an unused `ApplicationStatusBadge` import (one of the two existing lint warnings, not caused by this ticket).

### Docs sweep

Checked `docs/db-schema.md` (§2 enum, §3.5, §3.16, §4.3, §4.4, §5, §7), `.claude/rules/api.md`, `.claude/rules/web.md` and `GLOSSARY.md` against the code and the live pass. Corrected: the Criteria order sentence (§3.5), the "Former member" nuance (§3.16 and api.md), a stale "the board's comes in a later ticket" (api.md, Rate bullet), the history-line examples (web.md: every line ends with " (in <stage>)"), and the glossary entries Rating ("Former member") and Average rating (the "No ratings" and empty-card behaviour; only the overall counts). The glossary's Application Event entry already matches the event named `rated`. `CLAUDE.md`'s docs table needed no change: no dependency was added.

### Checks

`pnpm lint`: 0 errors, 2 existing web warnings. `pnpm check-types`: ok (`@repo/shared` only). `pnpm --filter @repo/shared test`: 17 files, 458 tests pass. `pnpm --filter api test`: 18 files, 400 tests pass. `pnpm --filter api exec tsc --noEmit -p tsconfig.json`: clean. `pnpm --filter web exec next typegen` then `tsc --noEmit`: clean. `feat/ratings` is an ancestor of this branch (it had not moved).

### Clean-up

The test company, its Job, applicants, Ratings, events, memberships and the four users were deleted from the dev DB (0 ratings, 0 `rated` events, 0 `rtest` rows left); no role was changed on any existing account; both of my servers are stopped; the browser tabs I opened are closed. `apps/web/AGENTS.md`, root `AGENTS.md` and `apps/api/tsconfig.build.tsbuildinfo` were rewritten by tooling and restored, not committed.

### Files

- Modified `.claude/rules/api.md`: the stale "later ticket" sentence and the "Former member" nuance.
- Modified `.claude/rules/web.md`: the history-line wording.
- Modified `docs/db-schema.md`: the Criteria order sentence (§3.5) and the "Former member" rule (§3.16).
- Modified `GLOSSARY.md`: Rating and Average rating entries.
- Modified `.scratch/ratings/spec.md`: status `resolved` and the follow-up notes.
- Modified `.scratch/ratings/issues/08-verification-pass-and-docs-sweep.md`: status, boxes, this Answer.
