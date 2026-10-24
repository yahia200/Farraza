# 07: Verification pass and docs sweep

**What to build:** Confirm the whole feature against the spec, and leave the docs matching the code. Spec: `.scratch/repeating-groups/spec.md`; decision record: ADR-0004.

The web pieces have no automated tests (the decision to test only through the shared package is recorded in the repo's learnings), so this ticket is the one place where the manual path is run in full and written down.

**Blocked by:** 06.

**Status:** resolved

- [ ] The spec's manual checklist is run in the browser pane and the results are written to this file under "## Results": insert both Presets, edit labels and limits, save, publish, apply with several Entries, trigger an error inside an Entry, review the candidate sheet, and open the builder as an interviewer
- [ ] The full automated suite passes (`pnpm --filter @repo/shared test`, `pnpm --filter api test`), and `pnpm lint`, `pnpm check-types` and `pnpm build` pass
- [ ] The schema doc matches the code: question types, answer shape, Preset key and catalog rules, and its "Later features" line about structured experience is updated (the types it mentions as pending are now built, except the separate `number`, `date` and `url` ticket)
- [ ] The architecture notes in the repo's rule files (shared package and web) describe the group type, the Preset key catalog, the Presets menu, the group step and the candidate sheet rendering
- [ ] The glossary still matches the words used in the UI copy; any mismatch is fixed in whichever is wrong
- [ ] A short list of anything found along the way that the spec did not anticipate is written to this file under "## Findings", or the section states that there was none

## Results

Run on branch `ticket/07-verification-and-docs` (from `feat/repeating-groups` at eb113ac) on 2026-10-24. Browser pass: scratch database `farraza_t07` in the dev Postgres container, the API on port 3101 and `next dev` on port 3100 from this worktree (process-env overrides, no `.env` edits), a throwaway localhost account and company, the built-in browser pane. No SQL shortcut was used for the product path; SQL was used only for the interviewer role switch and to read the stored answers. Servers stopped and the scratch database dropped afterwards.

**Automated**

- `pnpm --filter @repo/shared test`: 12 files, 298 tests passed.
- `pnpm --filter api test`: 15 files, 321 tests passed.
- `pnpm lint --force`: 0 errors. 10 oxlint warnings in `apps/api` (unused imports in `companies.controller.ts` and similar) and 2 ESLint warnings in `apps/web` (`candidate-card.tsx` unused `ApplicationStatusBadge`, `logo-name.tsx` unused `fill`); none in files of this feature.
- `pnpm check-types`: passed (turbo runs it for `@repo/shared` only). `tsc --noEmit` in `apps/api`: exit 0. `tsc --noEmit` in `apps/web` before a build: only the known `PageProps`/`LayoutProps`/`RouteContext` errors (30 lines, nothing else); after `pnpm build` generated the Next types: exit 0.
- `pnpm build`: passed (3 tasks: shared, api, web; Next.js 16.4.2 Turbopack, 23 static pages). Turbo warned "no output files found" for shared and api, which is existing.

**Browser checklist** (desktop 1024x768 unless noted)

1. Insert both Presets: the "Add question" menu shows a "Presets" group below the six types. After inserting Education it is greyed out; after Work experience both are. Cards read "Education / Required / Up to 3 entries" and so on; each group opens with "Most entries" and "Questions in each entry" (sub-question rows with the type and a Required badge).
2. Edit labels and limits: group label (Work experience to "Employment history"), Education limit 5 to 3 and made required, Company relabelled "Employer" with new help text and made optional, School relabelled "University". The card header badges updated live.
3. Builder errors: "Most entries" = 0 gave the red input, "Set an entry limit from 1 to 10." and a red card border. Clearing a sub-question label gave "Write the question." inside its row; the row header reads "Untitled question" and the row stayed open while invalid.
4. Save and publish: "Save draft" showed the toast "Draft saved", the cards collapsed, the draft survived a reload; "Publish" gave "Published version 1"; the job was opened.
5. Backup: an unsaved label edit wrote the `farraza:form-backup:...` key; after a reload the banner offered Restore (restored the edit, "Unsaved changes") and Discard (removed the backup).
6. Apply page, several Entries on both groups: the steps are CV, name, email, phone, then one step per group ("Question 5 of 6", "6 of 6"). Education starts with one card (required); "Add another" made cards 2 and 3 and was disabled at 3. The optional Employment history started with no card and a single "Add", then "Add another"; two jobs were entered, with the long text keeping its line break (Enter added a line and did not advance or submit). Enter in a text input inside an Entry did not advance the step.
7. Client-side error inside an Entry: Education card 2 with University but no Degree: only the Degree radios of card 2 turned red, with "This question needs an answer." and "Fix the answers marked above to continue."; card 1 and the blank card 3 had no error; choosing a degree cleared it. Employment card 2 without Start date: the same on card 2's Start date.
8. Server-side error inside an Entry: with the apply page open on version 1, version 2 was published making Employer required; Send application stayed on the group step and marked Employer in card 2 (path `<group>.1.<child>`) with "This question needs an answer." After filling it the application was sent ("Application sent"). The stored answers show index 1 of the Experience group, the blank third Education card dropped, blank optional sub-answers left out, and the application tied to version 2 (the server validates against the latest published version).
9. Candidate sheet: Answers show "Education" as two blocks (University, Degree "Bachelor's" / "Master's", Field of study; blank rows skipped) and "Employment history" as two blocks (the second without End date or description), with the labels the applicant saw. No console errors.
10. Interviewer: the role was changed to `interviewer` in SQL; it is cached per session, so a reload still showed owner controls until signing out and in again. Then the builder shows no Save/Publish, no move/delete buttons, no "Add question", no "Close job"; group and sub-question rows open; every input is `readOnly` and typing into the Employer label changed nothing; the Required switch is read-only. The role was set back to owner afterwards (same sign-out and sign-in).
11. Phone viewport 375px (builder as owner, apply page): found a real problem in the builder, fixed (Findings, item 1). After the fix neither page scrolls horizontally (`scrollWidth` 375), the Education card and its sub-question rows and the Employment cards on the apply step are in one column.
12. Console in a fresh tab: builder (both cards open), apply page (steps, Add another, Remove) and candidate sheet: only the React DevTools and HMR lines, no warnings or errors.

Not done: an end-to-end check of the optional single-choice clearing gap (no shipped Preset has an optional single choice; read from the code and earlier ticket notes); the candidate sheet as an interviewer (ticket 05 did it, and the sheet is identical for that role); comparing `pnpm build` with `main` (it passed here, so not needed).

**Docs sweep**

- `docs/db-schema.md` §4.1 and §4.2 already described the `repeating_group` type, answer shape, Preset key rules and catalog (tickets 01 and 02); checked against `form-fields.ts`, `answers.ts` and `preset-keys.ts`, no change needed there. §8.3 "Later features": the structured-experience line replaced (the group type and both Presets are built; `number`, `date` and `url`, CV autofill, single-question Presets and saved Presets are not).
- `.claude/rules/api.md`: "six field types" is now seven, with a new paragraph on repeating groups and the Preset key catalog (append-only, where the Preset definitions live).
- `.claude/rules/web.md`: the bullets from tickets 03, 04 and 05 were checked against the code (`compactAnswers`, `emptyValues`, `entriesOf`, `isLockedOption`, `stepOf`, `toNestErrors`, `SubQuestionRow`, `CandidateAnswer`, `formatAnswer` all exist; the menu greying and read-only behaviour match what was seen), with no duplication added; added a "Phone width" bullet and the known gaps of the group step.
- Glossary against UI copy: the builder ("Presets", "(Repeating group)" for screen readers, "Most entries", "Questions in each entry", "Up to N entries"), the apply step ("Add up to N entries.", "Education 1", "Add" / "Add another", "Remove", "Add an entry, or skip this question.") and the candidate sheet ("No answer", one block per Entry) use Question, Repeating group, Entry and Preset, and never section, template or field. One wording clash fixed on the glossary side: the Application Event definition said "An entry in an Application's append-only history", which now collides with Entry; it says "A record in ...". No UI string changed.

## Findings

1. **Phone-width overflow in the builder (fixed).** At 375px a group's card header (label, "Required" badge, "Up to N entries" badge, three buttons) cannot shrink; because a `<fieldset>` is `min-width: min-content`, the whole question list (`form-builder.tsx`) grew to 413px in a 343px column, so the cards ran off the right edge (the move and delete buttons were cut off) and the page scrolled sideways. Fixed here: `min-w-0` on that fieldset, and `hidden sm:inline-flex` on the "Up to N entries" badge (below `sm` there was no room left for the label itself; the limit is still in the card, in "Most entries"). Earlier tickets were checked at desktop width or with short headers. Files: `apps/web/components/dashboard/jobs/form-builder/form-builder.tsx`, `question-card.tsx`.
2. **Focus after an error (known gap, confirmed, slightly different from the earlier note).** On a client error the focus stays on the Next/Send button; after a server error it falls to the page body. In both cases the invalid input is marked and its message shown. It does not move to the invalid input in its card. Not fixed (this ticket is verification). Written in `web.md`.
3. **An optional single choice in a card cannot be cleared (known gap).** The applicant removes the card instead. No shipped Preset has one. Written in `web.md`.
4. **A stale apply page validates against the newest version.** An applicant who loaded version 1 and submits after version 2 is published is checked against version 2 and the application is stored on version 2; the page keeps showing version 1 labels and "(optional)" markers until the error appears. This is existing behaviour for every question type, not specific to groups. Group errors map to the right card in this case (item 8 above).
5. **Role changes are cached per session.** Changing a member's role in the database is not picked up until that user signs in again (only relevant to the SQL role switch used here).
6. **The builder header shows "Up to 0 entries" while the limit is invalid**, and the Next dev server logs Server Action arguments, including the scratch sign-in password (a Next dev feature). Both minor, not changed.
7. **Prettier:** shared files fail Prettier on the integration branch (CRLF working copy), as announced; nothing was reformatted. The two web files edited keep their CRLF endings.
8. Nothing else was missed by the spec: no change to the shared rules, the catalog, the apply step logic or the candidate sheet was needed.
