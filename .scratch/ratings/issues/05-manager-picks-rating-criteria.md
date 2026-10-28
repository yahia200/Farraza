# 05: A manager picks a Job's rating Criteria

**What to build:** A manager chooses up to five Criteria for a Job from a popover beside the existing Highlighted questions settings. Spec: `.scratch/ratings/spec.md` ("Web: Picker"). Model it on the Highlighted questions picker (`.scratch/highlighted-questions/issues/05-manager-picks-highlighted-questions.md` and its Answer).

- **Server Action** in `app/actions/` calling `PUT .../rating-criteria` through `lib/api.ts`; returns `ActionFailure` on failure; revalidates the cached board and the job.
- **Picker:** a ghost icon `Button` with an accessible name (for example "Choose rating criteria"), a `Popover` of `Checkbox` rows, one per catalog Criterion with its label, in catalog order; each toggle saves the whole list at once; at five ticked the rest are disabled with a line explaining the limit; shown only when `canManageJobs(role)`. Check `components/ui/` first, add components with `pnpm --filter web exec shadcn add <name>` if missing (`.claude/rules/web.md`).
- Copy uses the glossary words (Criterion, Rating).

**Blocked by:** 02.

**Status:** resolved

- [x] A manager ticks one, then five, and the sixth is blocked with an explanation
- [x] Each tick saves at once and survives a reload
- [x] An interviewer doesn't see the button
- [x] A Job with none ticked looks the same as before
- [x] Phone-width layout checked in the browser, and what was checked recorded
- [x] `.claude/rules/web.md` updated
- [x] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer

The picker and its Server Action are built and checked in the browser. Tickets 06 and 07 (the sheet, table and card) are not built yet, so persistence was checked through the picker's state, a reload and the `jobs.rating_criteria` column, not through any list.

`tdd` did not apply: web has no test runner and none was added (the spec says so), and there is no new pure logic (the catalog, limit and schema are already in `@repo/shared` from ticket 01 and tested there). The toggle is a few lines of UI state with one caller.

### What shipped

- **Button:** a ghost icon `Button` (`StarIcon`, accessible name "Choose rating criteria") right after the Highlighted questions button, beside `CandidatesViewToggle`, in both views.
- **Popover:** a shadcn `Popover` titled "Rating criteria" with a short description, a `<fieldset>` of `Checkbox` rows (each wrapped in a `Label`), one per `RATING_CRITERIA` entry in catalog order, and a line under the list: "Choose up to 5.", which becomes "You can choose up to 5 criteria. Untick one to choose another." at the limit, when the unticked boxes are `disabled`.
- **Saving:** each tick calls the new `saveRatingCriteria` action (`app/actions/jobs.ts`) with the whole new list, in catalog order. It re-validates with `saveRatingCriteriaSchema`, PUTs `.../rating-criteria`, returns `{ keys }` or an `ActionFailure` (403 "You don't have permission to change jobs.", 404 "This job no longer exists. Reload the page.", other statuses pass the API's message through), and revalidates the candidates page.
- **When it shows:** only when `canManageJobs(role)`. No form is read (the catalog is fixed), so it shows even for a Job with no published form.
- **Failure:** `useOptimistic` shows the tick at once; a failed save unticks itself when the transition ends and a toast says why. An sr-only `role="status"` line announces each saved change.

### Where it is mounted

`app/(dashboard)/dashboard/[companySlug]/jobs/[jobSlug]/candidates/page.tsx`, in the `flex items-center gap-2` row after `HighlightedQuestionsPicker`, with `savedKeys={job.ratingCriteria}`. I renamed the page's local `canPickHighlights` to `canManage`, since it now gates both pickers (and the form read).

### Choices (owner may want to review)

1. **A second component, not one generic picker.** I followed the Highlighted questions picker pattern (a pattern already in this repo) and wrote `rating-criteria-picker.tsx` as its own file. **Cost:** about 40 lines are near-duplicates (the popover shell, the optimistic toggle, the status line). **Rejected:** extracting a shared `LimitedCheckboxPicker` now. It would mean editing the shipped, checked Highlighted picker, and the two differ in where the options come from, the empty state, the copy and the action. Worth revisiting if a third picker appears.
2. **Icon:** `StarIcon`. It exists in the installed `lucide-react` (`apps/web/node_modules/lucide-react/dist/lucide-react.d.ts`: I grepped for the declaration). It differs from `Settings2Icon` on the neighbouring button and reads as "rating". **Rejected:** `ListChecksIcon` (I did not verify that it exists).
3. **Order and revalidation:** the list is sent in catalog order, not tick order, so the stored list doesn't depend on click order (ticket 02: the API stores what it is sent). Revalidation is `revalidatePath` on the literal candidates path, exactly as `saveHighlightedQuestions` does and for the same reasons (`apps/web/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md`; `02-guides/server-actions.md`, "A single response carries data and UI"; the DAL has no cache tags). A 400 also revalidates so a stale picker corrects itself; there is no 409 (no form is involved).
4. **No max-height on the list:** six rows always fit, so the Highlighted picker's scrolling frame is not copied. The `shrink-0` row class and the `has-data-disabled:` dimming are copied (the Checkbox is a `<span>`, so `disabled:` and `peer-disabled:` never match).
5. **Copy:** glossary words, lowercase ("criteria", "criterion"), "Rating criteria" as the title, and "Members" capitalised in the description, as the spec writes it.
6. **Stored keys outside the catalog** (they cannot be saved today) are not ticked, don't count toward the limit, and the next save leaves them out, like stale Highlighted keys.

### Docs relied on

- Base UI 1.8 `docs/react/components/popover.md` and `checkbox.md` and React's `useOptimistic` (`apps/web/node_modules/@types/react/index.d.ts`): **not re-read this session.** The picker reuses the existing wrappers (`components/ui/popover.tsx`, `checkbox.tsx`) with the same props as the Highlighted picker, whose Answer cites these docs, and it works in the browser. Treat those citations as inherited, not freshly verified.
- Next.js `revalidatePath.md` and `server-actions.md` (paths in choice 3), also inherited from the Highlighted ticket's reading.
- `@repo/shared` (ticket 01 Answer): `RATING_CRITERIA`, `RATING_CRITERIA_LIMIT`, `saveRatingCriteriaSchema`. Ticket 02 Answer: the PUT's `{ keys }` request and response, and `CompanyJob.ratingCriteria`.
- No shadcn component was added: `popover`, `checkbox`, `label` and `button` already exist in `components/ui/`. `dialog.tsx` and `alert-dialog.tsx` were not touched.

### Browser verification

Environment: the built-in browser pane. **Ports 3000/3001 were already held** by dev servers started from the main folder (not mine), and I did not stop them. I ran this worktree's API on 3011 (`PORT=3011 APP_URL=http://localhost:3010`) and its web app on 3010 (`API_URL=http://localhost:3011`) by overriding the environment, and stopped both afterwards. Account: the seed demo owner from `apps/api/scripts/seed-landing.ts` (farraza company). Jobs: Product Designer (no applicants; used for the ticks) and Senior Frontend Engineer (the phone check).

- **Owner, desktop (1024px):**
  - The button appears in the table view and in the board view.
  - Popover: six rows in catalog order (Technical skills, Problem solving, Communication, Culture fit, Leadership, Relevant experience), all unticked at first.
  - Ticked one, then four more: each stayed ticked and the status line announced "Rating on “Leadership”." At five ticked, the sixth box had `aria-disabled="true"` and `tabIndex -1`, and the line read "You can choose up to 5 criteria. Untick one to choose another."; clicking the sixth did nothing.
  - **Persistence:** `jobs.rating_criteria` in Postgres held exactly the five keys in catalog order. After a full reload the same five were ticked and the sixth was disabled.
  - Unticking one re-enabled the sixth and the line returned to "Choose up to 5."; the column then held four keys and the status line said "Stopped rating on “Technical skills”."
- **Keyboard:** Space on the focused button opens the popover and focus lands on the first checkbox; the popup is `role="dialog"` labelled "Rating criteria"; Space unticks; Escape closes it and focus returns to the button (`aria-expanded` false).
- **Failed save, network:** I patched `window.fetch` to reject Server Action requests. Ticking the sixth box (with four ticked) left it unticked and showed the toast "Couldn't change the rating criteria / Check your connection and try again." I did not catch the optimistic tick mid-flight: the rejection came back before my 150 ms read.
- **Failed save, API:** I temporarily set the owner's membership to `interviewer` in the dev DB. A tick went back to unticked, with the toast "You don't have permission to change jobs." and the column unchanged.
- **Interviewer view:** in that interviewer role, after a reload, the board had the Table/Board toggle but neither the rating criteria button nor the Highlighted questions button. The membership was then restored to `owner`.
- **"A Job with none ticked looks the same as before":** a Job with no Criteria renders as before apart from the new button. Nothing else on the page reads `ratingCriteria` yet (the sheet, table and card are tickets 06 and 07), so there was nothing else to compare.
- **Phone width (375x812, Senior Frontend Engineer, board view):** `scrollWidth` 375 before and after opening (no horizontal scroll); both 32px buttons fit on the toggle row; the popup spans x 28 to 332, inside the 16px gutter; each row measured 42px tall (the `min-h-11` class is applied; I did not investigate why it measures 42 rather than 44, and the Highlighted picker's Answer recorded 44); tapping a label ticked its box and saved, and tapping again unticked it.
- **Console:** no errors.
- **Not checked:** a second login (one column on the Job, returned to every member); touch-only focus behaviour (the pane emulates the viewport but clicks arrive as mouse clicks); light theme (only dark was seen); a screen reader (the status line text was read from the DOM, not heard).
- **Clean-up:** `jobs.rating_criteria` is `[]` for every Job again, the owner's role is `owner`, and my two dev servers are stopped. `apps/web/AGENTS.md`, root `AGENTS.md` and `apps/api/tsconfig.build.tsbuildinfo` were rewritten by tooling and restored, not committed.

### For tickets 06, 07 and 08

- `CompanyJob.ratingCriteria` (the saved keys, in catalog order) comes from `JobPage`'s `job` prop on the candidates page. The detail payload won't carry the Job's current Criteria, so pass `job.ratingCriteria` into `CandidateDetail` for the sheet's Criteria rows. The picker's revalidation refreshes it everywhere on that page.
- Shared web files I changed: `app/actions/jobs.ts` (appended `saveRatingCriteria` and its result type at the end; ticket 06's `saveRating` belongs in `app/actions/applications.ts`, so no overlap) and the candidates `page.tsx` (the new import, the `canManage` rename, one new `{canManage && ...}` block in the toggle row). Ticket 06 will also touch this page (to pass `ratingCriteria` to `CandidateDetail`), and ticket 07 may, so expect small textual merge conflicts there.
- Running a second set of dev servers: set `PORT`, `APP_URL` and `API_URL` in the environment (the `.env` files do not override them).

### Checks

- `pnpm lint`: 0 errors (API 10 warnings, web 2 warnings, all pre-existing and none in these files).
- `pnpm --filter web exec next typegen` then `pnpm --filter web exec tsc --noEmit`: clean. `pnpm check-types` (root, `@repo/shared` only): ok.
- `pnpm --filter @repo/shared test`: 17 files, 458 tests pass.
- Prettier with `--single-quote --print-width 120` passes on the two files I formatted (the new picker and `jobs.ts`).
- `feat/ratings` merged: it is already an ancestor of this branch (it had not moved), so the merge is a no-op.

### Files

- Created `apps/web/components/dashboard/candidates/rating-criteria-picker.tsx`: the picker (button, popover, checkboxes, limit line, optimistic save, toast, status line).
- Modified `apps/web/app/actions/jobs.ts`: the `saveRatingCriteria` Server Action and `SaveRatingCriteriaResult`.
- Modified `apps/web/app/(dashboard)/dashboard/[companySlug]/jobs/[jobSlug]/candidates/page.tsx`: renders the picker for managers and renames `canPickHighlights` to `canManage`.
- Modified `.claude/rules/web.md`: a note on the picker and its action under "Pipeline board".
- Modified `.scratch/ratings/issues/05-manager-picks-rating-criteria.md`: status, ticked boxes and this Answer.
