# 06: Verification pass and docs sweep

**What to build:** A final end-to-end check of the feature in the browser, and a sweep that the docs match what shipped. Spec: `.scratch/highlighted-questions/spec.md` ("Testing Decisions", "Docs").

Walk the whole flow on a Job with a published form that has at least one question of each highlightable type, one Repeating group and one file question, and Applications submitted before and after a form change: pick one, then three (the fourth is blocked); see the table columns and card blocks; reload; open as an interviewer; publish a new version that removes a Highlighted question and relabels an option; check an Application from the older version; check a Job with no published form; check phone width.

**Blocked by:** 04, 05.

**Status:** needs-triage

- [ ] Every browser check above is done, with what was seen recorded in the Answer
- [ ] The stale key disappears from both views after the new version is published, and the old Application keeps its applicant's option labels
- [ ] `docs/db-schema.md`, `.claude/rules/api.md` and `.claude/rules/web.md` describe the column, route, payload, picker, columns and card as built (no leftover "proposed" or ticket-only wording)
- [ ] `GLOSSARY.md` still matches the UI wording (Highlighted question; no "column" for a Stage)
- [ ] The spec's Further Notes assumption (Question keys persist across versions) is confirmed in `form-builder.tsx` and noted
- [ ] `pnpm lint`, `pnpm check-types`, `pnpm --filter @repo/shared test` and `pnpm --filter api test` pass

## Comments

## Answer

I walked the whole flow in the built-in browser pane against dev servers run from this worktree, checked the key-persistence assumption in the code and in the database, swept the docs, and fixed one bug the walk-through found (the picker's rows overlapped on a long form).

### Setup

- I started `pnpm --filter api dev` and `pnpm --filter web dev` from the worktree as background tasks. `preview_start` was used only by `url`, so the main checkout's `launch.json` was never involved. Afterwards I stopped both, including the node children that kept 3000/3001 open, and confirmed the ports were free.
- **Account:** the seed demo owner from `apps/api/scripts/seed-landing.ts` (company `farraza`). The pane was signed out at the end.
- **Test data:** a throwaway script outside the repo (`t06-seed.mjs` in the session scratchpad) drives the API. It signs in as the demo owner and sends apply requests through the public route, each with its own `x-client-ip`, so the 5-per-10-minutes limit didn't trip.
  - **Job "T06 Highlights check"** (`t06-highlights-check`). It is open, with CV off. Form v1 has one Question of each highlightable type (Notice period: text; a 104-character long-text Question; Work setup: single choice "On site in Cairo" / "Remote only"; Languages: multiple choice; a visa yes/no; Years of experience: number; Earliest start date: date; Portfolio: link). It also has a Repeating group "Past roles" (Company, Years there) and a file Question "Writing sample", all optional.
  - **Before the form change (v1):**
    - Amira: every type answered. Her long text is 294 characters with an emoji near the end, her number is `0`, and her group has one Entry.
    - Bassem: only Work setup and visa.
  - **v2** relabels Notice period to "Notice period (in weeks)" and adds a yes/no "Do you have a driving licence?".
  - **After the change (v2):**
    - Carla: most Questions answered, including the new one and `7.5`.
    - Dalia: nothing answered.
  - **v3** was published from the browser (below). Emad applied after it, choosing the relabelled option.
  - **Job "T06 No published form"**: it has only a draft.

### Browser checks (what I saw)

- **Picker contents (owner, table view):** 9 Questions, in form order. The Repeating group and the file Question are not listed.
- **Bug found:** the long Question's label overlapped the rows above and below it.
  - **Cause:** the list is a flex column with a max height. Each `Label` was shrunk to its `min-h-8` (32px), while its text was 58px tall, and the list didn't scroll (scrollHeight = clientHeight = 320).
  - **Fix:** setting `flex-shrink: 0` on the rows in DevTools confirmed the cause. The committed fix adds `shrink-0` (see "Bug fixed" below).
  - **After the fix:** rows are 31px, and 63px for the long one. The list scrolls (354px of content in 307px), and at 375px the rows are 44px and 66px. Ticket 05 didn't hit this: its job had 6 short Questions, which fit without shrinking.
- **Pick one:** I ticked Work setup.
  - At once, without a reload, a "Work setup" column appeared after Candidate.
  - It read "Remote only", "On site in Cairo", "Remote only" and "—".
- **Pick three:** I ticked the long Question and Years of experience as well.
  - The columns came out in form order (long Question, Work setup, Years of experience), not in tick order.
  - The other 6 boxes had `aria-disabled="true"` and `tabIndex -1`. The line under them read "You can show up to 3 questions. Untick one to choose another."
  - Clicking a disabled box (Languages) changed nothing: still 3 ticked.
- **Table cells:**
  - Amira's long text arrived cut at exactly 200 characters plus "…", then CSS cut it again to one line.
  - `0` shows as `0` and `7.5` as `7.5`.
  - An unanswered cell is "—" plus an sr-only "No answer".
  - The long header is truncated, and hovering it shows a tooltip with the full Question.
- **Header tooltip by keyboard: not reachable.**
  - The three Highlighted header spans have no focusable element. Tab from the Candidate sort button goes straight to the Stage sort button.
  - The full text is in the DOM, so a screen reader reads it, but a sighted keyboard user can't open the tooltip.
  - This is ticket 04's design (choice 2). It is listed under "Decisions for the owner".
- **Reload:** a full navigation to `?view=board` kept the same three, and the board cards showed the blocks under the name.
  - Each label is cut to one line ("Tell us about the hardest bug y…").
  - Answers are clamped to two lines: Amira's long text took exactly two lines.
  - "—" shows for none, and the Move select stays at the bottom.
- **Every type formatted (board, without a reload after each change in the picker):**
  - Languages showed "English, Arabic" (Amira) and "French" (Carla).
  - Visa showed "No" and "Yes".
  - Earliest start date showed "February 5, 2026" and "December 1, 2026".
  - Portfolio showed the URL as plain text. `highlight-answer.tsx` renders no `<a>`.
  - Notice period showed "4 weeks" (Amira, v1) under the latest label "Notice period (in weeks)".
- **Application on an older version:** with "Do you have a driving licence?" (v2 only) highlighted, Amira and Bassem (v1) showed "—", and Carla (v2) showed "Yes".
- **Publish a version that removes a Highlighted question and relabels an option:**
  - With Notice period, Work setup and Years of experience highlighted, I opened the form builder in the browser. I deleted "Years of experience", renamed the option "Remote only" to "Fully remote", and published (v3).
  - The stored keys still held the deleted Question's key (`50ea1478…`). Stale keys are not removed at publish, as designed.
  - **Table and board after v3:**
    - The Years of experience column and block were gone from both views.
    - Emad (v3) showed "Fully remote".
    - Amira and Carla (older versions, same option id) kept "Remote only".
    - Bassem kept "On site in Cairo".
  - Amira's sheet agrees with the list: "Remote only", "February 5, 2026", the full long answer, and her group Entry.
  - **Picker after v3:** it listed the 8 remaining Questions, with Notice period and Work setup ticked. Nothing was disabled, and the line read "Choose up to 3.", because the stale key doesn't count toward the limit.
- **Job with no published form:** no picker button in the table or the board ("No one has applied yet").
- **Job with no Highlighted questions** (`senior-frontend-engineer`): four columns at full width, as before.
- **Phone width (375×812):**
  - The table scrolls inside its frame (341px wide, 768px of content), and the page doesn't scroll sideways (document `scrollWidth` 375).
  - The board tabs show the blocks.
  - The picker fits (x 5 to 325) and its rows are at least 44px.
  - The popover sits 5px from the left edge, not 16px: Base UI's collision padding. This is cosmetic and I left it.
- **Light theme** (pane emulating `prefers-color-scheme: light`; `html` had `.light`): the table columns, the "—", the card blocks (muted label over answer) and the picker all read clearly.
- **Interviewer view:**
  - I temporarily set the demo owner's `farraza` membership to `interviewer` in the dev DB.
  - After a reload (the first navigation still showed the cached "Owner" from `'use cache: private'`), the sidebar said "Interviewer".
  - Both views showed the Highlighted columns and blocks with their values. There was no picker button, no Close job and no Move select.
  - The role was restored to `owner` right after.
- **Console:** no React, hydration or app errors or warnings. The buffer held 12 "WebSocket connection to ws://localhost:3000/_next/hmr failed" errors from the dev-only HMR socket, while every page load also logged "[HMR] connected". The web server log has no errors, and the API log has none.

### Key assumption: Question keys persist across saves and versions

Confirmed in the code (the file is `apps/web/components/dashboard/jobs/form-builder/form-builder.tsx`, not `dashboard/form-builder/`):

- **Keys are minted only when a Question is added:**
  - `newField` in `field-types.ts:60` (`key: crypto.randomUUID()`);
  - a Preset's `build()` in `presets.ts:25`.
  - No other `randomUUID` for keys exists in the builder or `app/actions/forms.ts`.
- **The builder starts from the stored fields:**
  - `form/page.tsx:29` passes `initialFields={(draft ?? published)?.fields ?? []}`;
  - `form-builder.tsx:92` passes them to `defaultValues`;
  - `form-builder.tsx:94` (comment) keeps RHF's own row `id` separate from `key`.
- **Every save sends the whole list unchanged:**
  - Save draft: `form-builder.tsx:162-165` (`saveFormDraft(..., { fields: data.fields, cvMode })`).
  - Publish: `form-builder.tsx:186-190` (`publishForm(..., isDirty ? content : null)` with `content = form.getValues()`).
- **The API stores them as sent:**
  - `forms.service.ts:47` and `:62` store `parsed.fields` (`parseFormFields` validates `key` as a UUID, `form-fields.ts:37`, and doesn't rewrite it).
  - Publish only sets `publishedAt` on the draft row (`forms.repository.ts:53-57`), so nothing is copied or re-keyed.
- **Checked in the database:** I compared the three `t06-highlights-check` versions.
  - v3, saved by the builder in the browser, has the same keys as v1 and v2 for every Question kept.
  - The deleted number Question is the only key missing.
  - The single choice's option ids are unchanged, and only the label of `53e993f9…` changed ("Remote only" to "Fully remote").

### Bug fixed (its own commit)

`highlighted-questions-picker.tsx`: `shrink-0` on each `Label` row, with a comment saying why.

- **Regression test:** none fits. This is CSS, and the web app has no test runner (spec, "Out of Scope"). I didn't use `tdd` for the same reason: there is no testable logic.
- **Verified:** in the browser, before and after the change, at 800px and 375px.
- **Docs:**
  - Tailwind `shrink-0` (`flex-shrink: 0`): https://tailwindcss.com/docs/flex-shrink (from memory, not opened). I checked the class exists in the installed Tailwind 4.3.3 by its effect in the browser.
  - The CSS rule that an explicit `min-height` replaces a flex item's automatic minimum size is from memory of https://developer.mozilla.org/en-US/docs/Web/CSS/flex-shrink. I didn't open it; the DevTools measurement above is the evidence.

### Docs sweep

- **`.claude/rules/api.md`:**
  - **Gap:** the `@repo/shared` section didn't mention the two new modules.
  - **Change:** I added a "Highlighted questions and answer text" paragraph: `highlights.ts` (`HIGHLIGHT_LIMIT`, `highlightableQuestions`, `isHighlightable`, `highlightedQuestionKeysSchema`, `checkHighlightKeys`) and `answer-text.ts` (`formatAnswerText` for the sheet, `formatHighlightText` for the board, `HIGHLIGHT_MAX_CHARACTERS`).
  - **Unchanged:** the jobs, concurrency and board-payload notes already match the code.
- **`.claude/rules/web.md`:**
  - It said `formatIsoDate` lives in `lib/format.ts`. Ticket 01 moved it to `@repo/shared` `dates.ts`, so I fixed that.
  - I added that the sheet's `formatLeaf` delegates to `formatAnswerText` and that the list uses `formatHighlightText` on the same rules.
  - I dropped a bare "(ticket 04)" from the Highlighted answers heading. It was ambiguous next to the other features' "ticket NN" labels.
  - I noted the picker rows' `shrink-0` and why.
  - **Unchanged:** the picker, table and card notes already describe what I saw. No "proposed" wording was left.
- **`docs/db-schema.md`:**
  - **Already right:** §3.5 (column, CHECK, meaning, route) and §7 (no FK, save rules, stale keys, the last-write-wins exception). The board payload isn't described in this doc (it's in `api.md`), and §8 has nothing about this feature.
  - **Change:** the `fields[].key` row (§4.1) now says *why* a key stays the same across versions (minted only when a Question is added, whole list saved unchanged). It also says that deleting and re-adding a Question gives a new key, which drops it from `highlighted_question_keys`.
- **`GLOSSARY.md`:** no change needed. The UI copy uses "Questions shown in the list", "Choose questions to show", "question" and "application" (lowercase), and never "column". The glossary's **Highlighted question** entry ("shown for every Application in a Job's candidate list, in both the table and the board… up to three… only single-answer Questions") matches the picker's description and the behaviour. "Column" stays in its _Avoid_ list.

### Other observation (not fixed, outside this feature)

- **The form builder scrolls sideways at 800px** when a Question's text is long: the card header doesn't truncate it. Seen on the `/form` page with the 104-character Question. That is the builder, not this feature, and more than a small fix, so I'm reporting it only.

### Checks

- `pnpm lint`: 0 errors. API: 10 warnings. Web: 2 warnings (`candidate-card.tsx` unused `ApplicationStatusBadge`, `logo-name.tsx` `fill`). Same counts as tickets 03-05, all already there.
- `pnpm check-types`: ok.
- `pnpm --filter @repo/shared test`: 15 files, 418 tests pass.
- `pnpm --filter api test`: 16 files, 343 tests pass.
- `tsc --noEmit` in `apps/web` (after `next typegen`) and in `apps/api`: clean.
- **Tooling noise restored:**
  - `next dev` rewrote the managed block in `apps/web/AGENTS.md`;
  - the shared build touched `apps/api/tsconfig.build.tsbuildinfo`;
  - turbo touched the root `AGENTS.md` (line endings).

### Dev DB

- **All test rows removed** in one SQL transaction: 2 jobs, 12 stages, 4 form versions, 5 Applications, 5 events and 5 candidates. There were no files or notes.
- **The role change was undone:** the membership is back to `owner`.
- **Verified against a snapshot taken before any change:** exact counts of `application_events` (19), `applications` (12), `candidates` (12), `companies` (4), `files` (0), `form_versions` (10), `jobs` (9), `memberships` (9), `notes` (0), `stages` (54) and `users` (9) all match. A hash over every `jobs` and `memberships` row also matches.
- **Sessions:** the pane's sign-in session was ended by signing out. The script's own sessions were signed out by the script.

### Decisions for the owner

1. **The header tooltip can't be reached by keyboard** (ticket 04, choice 2, confirmed here). Adding `tabIndex={0}` to the span is one line. It would add up to three tab stops that open a tooltip and do nothing else. Your call.
2. **The picker popover sits 5px from the screen edge at 375px**, from Base UI's default `collisionPadding`. A `collisionPadding={16}` on the Positioner would match the page's 16px gutter. It's cosmetic, so I left it.
3. **Form builder card headers don't truncate long Question text** (above). It may deserve its own ticket.

### Files

- Modified `apps/web/components/dashboard/candidates/highlighted-questions-picker.tsx`: `shrink-0` on each picker row, so a wrapping Question no longer overlaps its neighbours once the list scrolls (bug found in the walk-through).
- Modified `.claude/rules/api.md`: a `@repo/shared` paragraph on `highlights.ts` and `answer-text.ts`.
- Modified `.claude/rules/web.md`: `formatIsoDate`'s new home, the shared formatter behind the sheet, the picker rows' `shrink-0`, and no bare ticket label.
- Modified `docs/db-schema.md`: why a Question key stays the same across versions, and what deleting and re-adding does to Highlighted questions.
- Modified `.scratch/highlighted-questions/issues/06-verification-pass-and-docs-sweep.md`: this Answer.
