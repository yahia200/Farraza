# 05: A manager picks the Highlighted questions

**What to build:** On the candidates page, a person who can manage jobs opens a popover from a ghost icon button and ticks up to three Questions; each change saves at once. Spec: `.scratch/highlighted-questions/spec.md` ("Web").

- A `Button` `variant="ghost"` with a settings icon and an accessible name (for example "Choose questions to show") beside `CandidatesViewToggle`. It opens a shadcn `Popover` of `Checkbox` rows, one per highlightable Question of the **latest published form**, in form order, ticked from the Job's `highlightedQuestionKeys`. Check `apps/web/components/ui/` for `popover` and `checkbox`; add missing ones with `pnpm --filter web exec shadcn add <name>`, and read the Base UI docs under `apps/web/node_modules/@base-ui/react/docs/` first.
- Each toggle calls a new Server Action (`apps/web/app/actions/`) that PUTs the whole new list through `lib/api.ts` (ticket 02), returns `ActionFailure` on failure, toasts the failure, and revalidates the cached board and the job so the lists update without a reload. At three ticked, the remaining boxes are disabled with a line saying why.
- Shown only when `canManageJobs(role)`; interviewers see the Highlighted answers but no button. A Job with no published form shows no button. The Questions come from the published form; if the DAL only exposes the draft, add a published read.
- Glossary wording only; final copy is yours to choose.

**Blocked by:** 02. (Ticket 04 makes the effect visible, so verify together if 04 has landed.)

**Status:** needs-triage

- [ ] The button appears for owner, admin and recruiter, not for interviewers, and not for a Job with no published form
- [ ] The popover lists only highlightable Questions of the latest published form, in form order, with the current choice ticked
- [ ] Ticking or unticking saves immediately and the table and cards update without a reload
- [ ] At three ticked the others are disabled with an explanation; unticking one re-enables them
- [ ] A failed save toasts and the checkboxes return to the saved state
- [ ] The choice persists after a reload and is the same for another member
- [ ] Keyboard and screen-reader use works (focus, names, Escape closes), following Base UI's docs
- [ ] Checked in the browser pane at desktop and phone width, as an owner and as an interviewer (use a `<name>.localhost:3000` second login per `.claude/rules/web.md`); no console errors
- [ ] `.claude/rules/web.md` updated for the picker and the action
- [ ] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer

The picker and its Server Action are built and checked in the browser. Ticket 04 (the table columns and card blocks) didn't exist on this branch, so saving and persistence were checked through the picker's state, reloads and the `jobs.highlighted_question_keys` column, not through the list.

### What shipped

- **Button:** a ghost icon button beside `CandidatesViewToggle`, in both views. It uses `Settings2Icon` and has the accessible name "Choose questions to show".
- **Popover:** a shadcn `Popover` with the title "Questions shown in the list" and a short description. Inside is a `<fieldset>` with one `Checkbox` per highlightable Question of the latest published form, in form order. Each checkbox is wrapped in a `Label`. Under the list is a line: "Choose up to 3.", which becomes "You can show up to 3 questions. Untick one to choose another." at the limit. At three ticked, the other boxes are disabled.
- **When it shows:** the page renders the picker only when `canManageJobs(role)` and `getJobForm(...).published` exists. The form is fetched only for those roles.
- **Saving:** each tick calls the new `saveHighlightedQuestions` action (`app/actions/jobs.ts`) with the whole new list.
  - The action re-validates with `saveHighlightedQuestionsSchema` and PUTs `.../highlighted-questions`.
  - It returns `{ keys }`, or an `ActionFailure`: 403 is "You don't have permission to change jobs.", 404 is its own message, and 400/409 pass the API's message through.
  - It revalidates the candidates page.
- **Failed save:** `useOptimistic` shows the tick at once. If the save fails, the box goes back and a toast says why.
- **Screen readers:** an sr-only `role="status"` line announces each saved change.

### Choices (owner may want to review)

1. **Where the published Questions come from.**
   - **Chosen:** reuse the existing `getJobForm(companySlug, jobSlug).published` (`lib/dal.ts`). It is already `'use cache: private'` and already returns the latest published version (the API's `FormsService` calls `findLatestPublished`). The page passes `highlightableQuestions(published.fields)` to the picker. `dal.ts` is **not changed**, so it doesn't collide with ticket 03's DAL edits.
   - **Rejected:** a new `getPublishedForm` DAL function. It would call the same endpoint, so the code would be duplicated for no gain.
   - **Rejected:** using the draft. The spec forbids it.
2. **Where the action lives and how it is shaped.**
   - **Chosen:** `app/actions/jobs.ts`, because the route belongs to the jobs module. It follows the pattern of `moveApplication` (`app/actions/applications.ts`): re-validate, `apiFetch`, 401 redirects to sign-in, `failureFromResponse` with per-status overrides, revalidate on success and on a stale view (400/409).
   - Its result is `ActionFailure<never> & { keys?: string[] }`, mirroring ticket 02's `{ keys }` response.
3. **Revalidation.**
   - **Chosen:** `revalidatePath('/dashboard/<c>/jobs/<j>/candidates')`, a literal path, as `moveApplication` does. The candidates page reads both the job (the saved keys) and the board, and the re-render comes back in the same response as the action.
   - Docs: `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` ("Server Functions: Updates the UI immediately") and `02-guides/server-actions.md` ("A single response carries data and UI").
   - **Rejected:** `revalidatePath('/', 'layout')`, as `updateJob` uses. It purges every cached page for a change that only the candidates page shows.
   - **Rejected:** `revalidatePath('/dashboard/[companySlug]/jobs/[jobSlug]', 'layout')`. A pattern path invalidates every job of every company.
   - **Rejected:** `updateTag`. The DAL functions have no `cacheTag`, and adding tags means editing `dal.ts` while ticket 03 is changing it.
   - **Rejected:** `refresh()` (`04-functions/refresh.md`). It re-renders the route but doesn't invalidate cached data.
   - The public job isn't expired, because applicants never see this choice.
4. **Rapid ticks.**
   - **Chosen:** no queue or lock of our own. Next.js dispatches Server Actions one at a time per client (`02-guides/server-actions.md`, "Sequential dispatch on the client"), so the PUTs reach the API in tick order, and each one carries the full list computed from the optimistic state.
   - **Rejected:** disabling the boxes while a save runs. A disabled Base UI checkbox leaves the tab order (`tabIndex -1`, seen in the browser), so a keyboard user would lose their place.
   - **Rejected:** a promise queue in the component. It duplicates what the framework already guarantees.
   - `useOptimistic` comes from `apps/web/node_modules/@types/react/index.d.ts` (`useOptimistic<State>(passthrough)` with a setter that takes the new state). The pattern follows `PipelineBoard`.
5. **Stale keys.** Stored keys that the published form no longer has are not ticked and don't count toward the limit. The next save leaves them out, as the spec says.
6. **Popover options** (Base UI docs `apps/web/node_modules/@base-ui/react/docs/react/components/popover.md`, Root `modal` and Popup `initialFocus`/`finalFocus`):
   - It is non-modal (the default). Opening it moves focus to the first checkbox. A touch open focuses the popup instead, per the `initialFocus` docs. Escape, or tabbing past the last box, closes it, and focus returns to the button.
   - `align="start"`, so it opens over the content rather than over the sidebar.
   - The list scrolls inside `max-h-[min(20rem,calc(var(--available-height)-10rem))]` (`--available-height` is a Positioner CSS variable in the same doc) for long forms.
   - **Rejected:** `modal`. It would lock the page, and it needs a `Popover.Close` for focus trapping.
7. **Checkbox labelling:** the enclosing-`<label>` pattern (Base UI `docs/react/components/checkbox.md`, "Labeling a checkbox"), as `FileConfigEditor` and `GroupStep` already do.
   - The generated `components/ui/checkbox.tsx` styles `disabled:`. That never matches, because the root is a `<span>` with `data-disabled`.
   - `Label`'s `peer-disabled:` doesn't match for the same reason.
   - So the row dims with `has-data-disabled:` on the `Label`. I didn't edit the generated file. **Existing deviation:** other disabled Checkboxes in the app (the group-step choice limit) probably don't look disabled either.
8. **A published form with no highlightable Question** still shows the button. The popover then explains which types can be shown. **Rejected:** hiding the button, which leaves a manager wondering why the setting doesn't exist. The spec only asks to hide it when there's no published form, so this is my call.
9. **Icon:** `Settings2Icon` (sliders), present in the installed `lucide-react` 1.52.0 (`dist/lucide-react.d.ts`). I chose it over the `SettingsIcon` gear, which reads as job settings. The claim that shadcn's data-table "view options" uses this icon is **from memory, not verified**.
10. **No pure logic extracted, so no `tdd`.** The toggle (set add/remove, then form order) is a few lines of UI state with one caller. The rules it depends on (`highlightableQuestions`, `HIGHLIGHT_LIMIT`, the key schema) are already in `@repo/shared` and tested.
11. **Copy:** lowercase "question" and "application" in the UI, the glossary words without capitals. "Questions shown in the list", never "columns".
12. **Prettier:** web has no Prettier config, and the existing web files (single quotes, width 120) don't pass a bare `prettier --check`. I formatted the new picker with `--single-quote --print-width 120` to match its neighbours, and left the formatting of `jobs.ts` and `page.tsx` as it was.

### Docs relied on

- Next.js (installed next resolves to 16.4.2 in the pnpm store; CLAUDE.md lists 16.4.0):
  - `01-app/03-api-reference/04-functions/revalidatePath.md`
  - `04-functions/refresh.md`
  - `02-guides/server-actions.md` (sequential dispatch, single-response re-render)
  - `03-api-reference/01-directives/use-cache-private.md`
- Base UI 1.8: `docs/react/components/popover.md` (anatomy, Root `modal`, Popup `initialFocus`/`finalFocus`, Positioner CSS variables) and `docs/react/components/checkbox.md` (labelling, `disabled`, `onCheckedChange`).
- shadcn CLI: `pnpm --filter web exec shadcn add popover --help`, then `--dry-run` (1 new file, no other changes) before adding.
- React: `useOptimistic` types in `apps/web/node_modules/@types/react/index.d.ts` (19.3.0).
- Shared (tickets 01 and 02): `highlightableQuestions`, `HIGHLIGHT_LIMIT`, `saveHighlightedQuestionsSchema`, and the PUT route's `{ keys }` request and response with its 400/409 shapes.

### Browser verification (built-in browser pane; dev servers run from this worktree)

- **Account:** the seed demo owner from `apps/api/scripts/seed-landing.ts` (farraza company).
- **Owner, desktop, Senior Frontend Engineer (published form with 6 highlightable Questions and 1 file):**
  - The button shows in the table view and in the board view.
  - The popover lists the 6 Questions in form order and leaves out the file Question.
- **Keyboard:**
  - Space on the focused button opens the popover, and focus lands on the first checkbox.
  - Space ticks a box, and Tab then Space ticks the next.
  - Escape closes the popover and focus returns to the button, whose `aria-expanded` goes back to false.
  - The popup is `role="dialog"`, labelled by its title.
- **Limit:**
  - With three ticked, the other three have `aria-disabled="true"` and `tabIndex -1`, and the limit line reads "You can show up to 3 questions. Untick one to choose another."
  - Unticking one re-enables them and the line goes back to "Choose up to 3.".
  - The status line announced "Stopped showing “How long have you worked with React?” in the list."
- **Persistence:**
  - Each tick wrote the full list in form order to `jobs.highlighted_question_keys` (checked in Postgres).
  - After a reload, the same three were ticked and the rest disabled.
- **Failed save, network:** I patched `window.fetch` to reject Server Action requests. Ticking showed the tick, then the box went back unticked, with the toast "Couldn't change the questions shown / Check your connection and try again."
- **Failed save, API:** I temporarily set the owner's membership to `interviewer` in the dev DB, so the API answered 403. Ticking went back, with the toast "You don't have permission to change jobs." The role was restored afterwards.
- **Interviewer view:** in that same temporary interviewer role, after a reload, the board and table had no button.
  - **Deviation from the brief:** I didn't use a second login at `<name>.localhost:3000`. Switching the role covered the interviewer UI without creating an account and password.
  - "The same for another member" holds by construction: one column on the job, which the API returns to every member. Showing it to members is ticket 04.
- **Job with no published form:** Marketing Intern (draft, no published version), as the owner, shows no button.
- **Phone width (375×812):**
  - The board and the button fit with no horizontal scroll (`scrollWidth` 375).
  - The popover spans x 16 to 320.
  - Rows are at least 44px tall.
  - Tapping a label ticks its box, and the save works.
- **Stale keys:** I stored two unknown UUIDs plus one valid key. Only the valid one showed ticked, and nothing was disabled. The next tick saved exactly two valid keys, so the stale ones were dropped.
- **Console:** no errors or warnings, only HMR and Fast Refresh logs.
- **Clean-up:** the dev DB is back where it started. The job's keys are `[]` and the owner's role is `owner`. Both dev servers are stopped.

### Checks

- `pnpm lint`: 0 errors.
  - web has 2 warnings, both pre-existing: `candidate-card.tsx`, `logo-name.tsx`.
  - api has 10 warnings, all pre-existing.
- `pnpm check-types`: ok.
- `tsc --noEmit` in `apps/web` (after `next typegen`) and in `apps/api`: clean.
- `next dev` rewrote the agent-feedback block in `apps/web/AGENTS.md` with different text, not just line endings: the installed 16.4.2 writes a newer block. I restored the file rather than commit tooling churn, so the owner may see it come back.

### Files

- Created `apps/web/components/ui/popover.tsx`: shadcn `popover`, generated by `shadcn add popover` and unchanged.
- Created `apps/web/components/dashboard/candidates/highlighted-questions-picker.tsx`: the picker (button, popover, checkboxes, limit line, optimistic save, toast, status line).
- Modified `apps/web/app/actions/jobs.ts`: the `saveHighlightedQuestions` Server Action and `SaveHighlightedQuestionsResult`.
- Modified `apps/web/app/(dashboard)/dashboard/[companySlug]/jobs/[jobSlug]/candidates/page.tsx`: managers' form read, the published form's highlightable Questions, and the picker rendered beside the view toggle.
- Modified `.claude/rules/web.md`: notes on the picker and the action under "Pipeline board".
- Modified `.scratch/highlighted-questions/issues/05-manager-picks-highlighted-questions.md`: this Answer.
