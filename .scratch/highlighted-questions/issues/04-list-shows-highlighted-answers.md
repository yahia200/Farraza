# 04: The table and the board card show the Highlighted answers

**What to build:** A reviewer sees the Highlighted questions' answers on the candidates table and the board card. Spec: `.scratch/highlighted-questions/spec.md` ("Web").

- **Table:** one column per Highlighted question, after Candidate and before Stage. Header = the Question's latest text, truncated, full text in a tooltip. Cell = the answer clamped to one line, or `—` for `null`. Display-only (`enableSorting: false`, no filter). The set of columns varies per Job, so build them per render; read the `.d.ts` in `apps/web/node_modules/@tanstack/table-core` (TanStack Table v9) for how, and follow `candidates/columns.tsx` and `data-table-features.ts`.
- **Board card:** under the name, a vertical list of blocks, each the Question text in small muted type above the answer clamped to two lines (`—` for `null`). The "Move to stage" select stays at the bottom. `candidate-card.tsx` is mid-edit in the working tree (its email/date line and the drag-preview `TODO(human)`); build on whatever is there and do not restore or remove either.
- With no Highlighted questions, both views look exactly as they do now.
- Use the glossary words (Question, Application, Stage); don't call these "columns" in any UI copy.

**Blocked by:** 03.

**Status:** needs-triage

- [ ] The table shows a column per Highlighted question after Candidate, headers truncated with a tooltip, cells on one line
- [ ] The board card shows a label-over-answer block per Highlighted question under the name, answers clamped to two lines
- [ ] A `null` answer shows `—` in both views
- [ ] A Job with no Highlighted questions renders both views unchanged
- [ ] Sorting and the stage filter still work; the new columns are not sortable
- [ ] Drag and drop, the Move select and opening the sheet still work on a card with blocks
- [ ] Checked in the browser pane at desktop and phone width (table and board tabs); no console errors
- [ ] `.claude/rules/web.md` updated for the table columns and the card
- [ ] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer

The table gains a column for each Highlighted question, after Candidate. The board card gains a label-over-answer block for each one, under the name. With none, both views are as before. I also fixed a layout bug that the browser check found (choice 5). There are no web tests, so this was verified in the browser pane against the worktree's own dev servers, and with `tsc` and the linters.

### Choices (owner may want to review)

1. **Building the columns per Job.**
   - **Chosen:** `columns.tsx` keeps Candidate, Stage, Status and Applied as module-level column definitions. It exports `candidateColumns(highlightedQuestions)`, which returns `columnHelper.columns([candidate, ...highlightedQuestions.map(highlightColumn), stage, status, applied])`. `CandidatesTable` calls it inside `useMemo` keyed on `highlightedQuestions`.
   - **Why:** TanStack Table v9 wants `columns` to stay the same array between renders. In table-core 9.2.8, `skills/core/SKILL.md` ("Essential constraints") says an inline column factory "invalidates model work and can cause render loops". `next.config.ts` has no React Compiler, so the memo has to be written by hand. `highlightedQuestions` arrives as a server prop, so it only changes when the server re-renders (a pick or a move).
   - **Rejected:**
     - Building the columns in the page: a Server Component can't pass the header and cell functions to the client.
     - Declaring every possible column and hiding the rest with `columnVisibilityFeature`: the set of Questions is per Job, so no fixed list exists.
   - Each Highlighted column is an `accessor` (a data column), not a `display` column. `display` is for "non-data columns like actions" (`dist/helpers/columnHelper.d.ts`).
   - The id is `highlight-<key>`. Keys are UUIDs, so an id can't clash with `candidate`, `stage`, `status` or `submittedAt`.
   - The columns set `enableSorting: false` and `enableColumnFilter: false` (`features/row-sorting/rowSortingFeature.types.d.ts` l.74, `features/column-filtering/columnFilteringFeature.types.d.ts` l.111). Status only sets the first. I added the second because the spec says "no filter", although no filter UI could reach these columns anyway.
2. **Header tooltip.**
   - **Chosen:** the shadcn `Tooltip` already in `components/ui/tooltip.tsx` (Base UI). The `TooltipTrigger` is rendered as a `<span>` (`render={<span />}`) holding the truncated text, and the full text is in the tooltip.
   - **Why:** Base UI's trigger "Renders a `<button>` element" (`node_modules/@base-ui/react/docs/react/components/tooltip.md`, "Trigger"). A button in a header that does nothing when pressed would be a fake control. The full label stays in the DOM, and `truncate` is CSS only, so screen readers read all of it. Base UI turns tooltips off on touch devices ("Alternatives to tooltips" in the same doc), so phone users see the cut header.
   - **Rejected:**
     - A native `title` attribute: it looks different from the rest of the app, and the shadcn rule says to use the existing component.
     - `tabIndex={0}` on the span: it would add up to three keyboard stops that do nothing.
     - A Popover with `openOnHover`: the docs suggest it for info that touch users need. Here the sheet already shows every Question in full, so a header-only popover seemed heavy. **Open question for you:** if keyboard users should be able to read a cut header without opening the sheet, the span needs `tabIndex={0}`. That's a one-line change.
3. **The "—" for no answer.** `HighlightAnswer` (`highlight-answer.tsx`) is shared by the table and the card. It renders `null` as an `aria-hidden` "—" plus an sr-only "No answer", the sheet's words, so a screen reader doesn't say "em dash". The rejected option was a bare "—".
4. **Card blocks inside the link.**
   - **Chosen:** the `<dl>` of blocks sits inside the card's `<Link>`, under the name. The link gets `aria-labelledby` pointing at the name's `useId()` id.
   - **Why:** the link is the drag handle and opens the sheet. Inside it, the blocks keep the whole upper card clickable and draggable, as before. `aria-labelledby` keeps the link's name to just the candidate instead of every answer.
   - **Rejected:** blocks as a sibling between the link and the Select. That part of the card would neither open the sheet nor start a drag, which feels broken. Moving the drag handle to the whole card isn't possible, because then pressing the Select would start a drag (see `.claude/rules/web.md`).
   - Each `dt` (the Question) is cut to one line, so a long Question doesn't push the answers apart. Its full text is in the table header tooltip and in the sheet.
   - Each `dd` is `line-clamp-2 wrap-anywhere`, so a long unbroken link answer wraps inside the card instead of overflowing it. Tailwind 4.3.3 has `wrap-anywhere`, `wrap-break-word` and `line-clamp`: I checked the names in `node_modules/.pnpm/tailwindcss@4.3.3/node_modules/tailwindcss/dist/lib.js`. Docs: https://tailwindcss.com/docs/overflow-wrap, https://tailwindcss.com/docs/line-clamp (from memory, not opened).
5. **Layout fix found in the browser: `w-0 min-w-full` on the table's wrapper** (`candidates-table.tsx`, its own commit).
   - **The bug:** with three Highlighted columns, the table's minimum width (about 1,050 px) was more than the content area. Nothing in the flex chain let it shrink, so the whole dashboard (`SidebarInset`) grew past the window and the page scrolled sideways, with Copy link and Close job off-screen.
   - **The fix:** the table now scrolls inside its own frame, at desktop and at 375 px. This is the board row's existing pattern (`pipeline-board.tsx`, "the row scrolls inside the page instead of its width widening the whole layout").
   - **Rejected:**
     - `min-w-0` on `SidebarInset` in the dashboard layout: it would fix every page, but it is a wider change than this ticket.
     - Changing the shared `DataTable`: the members and jobs tables never get this wide.
   - The members and jobs tables have the same latent bug, if they ever grow wide.
6. **Existing deviation, not copied or changed.** The table-core docs for this version recommend `tableMeta: metaHelper<T>()` / `columnMeta: metaHelper<T>()` (`skills/core/references/typescript.md`, "Setup"). `data-table-features.ts` uses the older `{} as T`. I kept the existing pattern; it is a separate clean-up if you want it.

The card's in-flux state is kept as it was: the whitespace line where the email/date line was, the unused `ApplicationStatusBadge` import (a lint warning), and the drag-preview `TODO(human)`. I did not restore or remove any of them.

### Verified in the browser pane

`preview_start` reads the main checkout's `.claude/launch.json`, so it started servers from `D:\Side Projects\Farraza` (the integration branch), not this worktree. I spotted that, stopped them, and ran `pnpm --filter api dev` and `pnpm --filter web dev` from the worktree as background tasks. I opened the pane with `preview_start` by URL, and stopped both servers at the end (ports 3000/3001 free). The data came from a throwaway script (outside the repo) that drives the API:
- It signed in as the seed demo owner from `apps/api/scripts/seed-landing.ts`.
- It created the job "T04 Highlights check" in `farraza`, with an optional form: Notice period (text), a long on-site single choice, Years of experience (number), Cover note (long text) and Portfolio (link).
- It published the form, opened the job, and sent 4 applications through the public route: one full with a 300-character note and the number `0`, one with only Notice period, one partial, one empty.
- It saved the keys through `PUT .../highlighted-questions`, stored out of form order (Cover note first).
- Afterwards I deleted the job, its 4 Applications (their events cascade) and the 4 test candidates in one SQL transaction. Nothing else was changed: `senior-frontend-engineer` was only viewed.

Checked at 1024 px (the pane) and 375 px:
- **Table:** the columns sit after Candidate and before Stage, in form order (not the stored order), with the latest text. The long header is cut and its tooltip shows the full Question. Cells are on one line: the 300-character note arrives cut at 200 with "…" and is cut again by CSS. `0` shows as `0`, and unanswered cells show `—`.
- **Sorting:** Candidate sorts both ways. The Highlighted headers are not sort buttons; `find` lists only Candidate, Stage and Applied as buttons.
- **Stage filter:** "Screening (1)" shows just that row, with its highlights.
- **Board:** each card shows the blocks under the name, the label on one line and the answer clamped to two lines, with `—` for none, and the Move select at the bottom.
  - The Move select moved a card to Screening.
  - Dragging a card by its blocks area moved it to Interview, and no sheet opened.
  - Clicking the blocks area opened the sheet, whose answers match the card.
  - Each card link's accessible name is just the candidate.
- **Picker (ticket 05) with no reload:**
  - In the table, unticking Cover note and ticking Notice period changed the columns at once, in form order. The stage filter stayed applied across the column rebuild.
  - On the board, unticking all three put the cards back to name plus Select (no `<dl>`), and ticking three again brought the blocks back.
- **No Highlighted questions** (`senior-frontend-engineer`): the table has its four columns at full width (no inner scroll) and the cards are name-only, as before.
- **Phone width:** the board tabs show the blocks and the page has no sideways scroll (`scrollWidth` 375). The table scrolls inside its frame (341 px wide, 1051 px of content) with no page scroll.
- **Console:** no errors or warnings. In the web server log, the only errors are `ECONNREFUSED` from before the API had started. One "Fast Refresh had to perform a full reload" line appeared when I edited `candidates-table.tsx` while on another page.

Not checked in the browser:
- **An interviewer's view:** they get the same props and no picker (ticket 05).
- **Dark versus light theme:** the pane ran dark. The new text uses `text-muted-foreground` and the default foreground only.
- **The tooltip from the keyboard:** see choice 2.

### Checks

- `pnpm lint`: 0 errors. There are 10 api warnings, the same count ticket 03 recorded. The 2 web warnings are the card's unused `ApplicationStatusBadge` import (in-flux state, left alone) and `fill`, both already reported by ticket 03.
- `pnpm check-types`: ok.
- `tsc --noEmit`: clean in `apps/web` (after `next typegen`) and in `apps/api`, both before and after merging the integration tip.
- Prettier: `apps/web` has no Prettier config (only `apps/api/.prettierrc`), so `prettier --check` would apply the defaults (double quotes, 80 columns) that no web file follows. I matched the files' own style (single quotes, about 120 columns) instead.
- **Merge:** I merged `feat/highlighted-questions` at 8f50292 (ticket 05) and resolved the `candidates/page.tsx` conflict by keeping both sides: the picker and its `getJobForm` read, plus `highlightedQuestions` to the table and the board.
- **Tooling noise restored:** `next dev` rewrote its managed feedback block in `apps/web/AGENTS.md` (content, from the installed Next 16.4.2), the shared build touched the tracked `apps/api/tsconfig.build.tsbuildinfo`, and turbo changed the root `AGENTS.md` line endings. None of these is part of this ticket.

### Docs relied on

- TanStack Table v9 (`@tanstack/table-core` 9.2.8, under `node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/`):
  - `dist/helpers/columnHelper.d.ts`: `accessor`, `columns` (a variadic tuple, so a spread array type-checks), `display`.
  - `skills/core/SKILL.md`: keep `columns` stable.
  - `skills/core/references/typescript.md`: `helper.columns()` keeps each column's value type; `metaHelper`.
  - The two `.d.ts` files cited in choice 1.
- Base UI Tooltip: `apps/web/node_modules/@base-ui/react/docs/react/components/tooltip.md` ("Trigger" props, "Alternatives to tooltips"); the shadcn wrapper is `components/ui/tooltip.tsx`.
- React `useMemo` and `useId`: from memory (https://react.dev/reference/react/useMemo, https://react.dev/reference/react/useId), not opened.
- Tailwind utilities: choice 4.
- Patterns followed:
  - `w-0 min-w-full` from `pipeline-board.tsx`.
  - The table setup from `candidates/columns.tsx` and `data-table-features.ts`.
  - The card's link/Select structure and drag handle from `.claude/rules/web.md` ("Pipeline board").
  - "No answer" from the sheet.
  - The ticket 03 DAL types (`HighlightedQuestion`, `highlights`).

### Files

- Created `apps/web/components/dashboard/candidates/highlight-answer.tsx`: renders one Highlighted answer, or "—" with an sr-only "No answer", for the table and the card.
- Modified `apps/web/components/dashboard/candidates/columns.tsx`: `candidateColumns` is now a function of `highlightedQuestions` that inserts one display-only column per Question after Candidate (truncated header with a tooltip, one-line cell).
- Modified `apps/web/components/dashboard/candidates/candidates-table.tsx`:
  - takes `highlightedQuestions` and memoizes the columns on it;
  - the wrapper is `w-0 min-w-full`, so a wide table scrolls inside its frame.
- Modified `apps/web/components/dashboard/candidates/candidate-card.tsx`: takes `highlightedQuestions` and renders the label-over-answer blocks under the name; the link is named by the candidate (`aria-labelledby`).
- Modified `apps/web/components/dashboard/candidates/pipeline-board.tsx`: passes `highlightedQuestions` through `StageCards` to each card.
- Modified `apps/web/app/(dashboard)/dashboard/[companySlug]/jobs/[jobSlug]/candidates/page.tsx`: passes the board's `highlightedQuestions` to the table and the board (merged with ticket 05's picker).
- Modified `.claude/rules/web.md`: a "Highlighted answers in the table and on the card" bullet under "Pipeline board".
- Modified `.scratch/highlighted-questions/issues/04-list-shows-highlighted-answers.md`: this Answer.
