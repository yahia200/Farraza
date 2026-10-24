# 07: Verification pass and docs sweep

**What to build:** Confirm the whole feature against the spec, and leave the docs matching the code. Spec: `.scratch/repeating-groups/spec.md`; decision record: ADR-0004.

The web pieces have no automated tests (the decision to test only through the shared package is recorded in the repo's learnings), so this ticket is the one place where the manual path is run in full and written down.

**Blocked by:** 06.

**Status:** ready-for-agent

- [ ] The spec's manual checklist is run in the browser pane and the results are written to this file under "## Results": insert both Presets, edit labels and limits, save, publish, apply with several Entries, trigger an error inside an Entry, review the candidate sheet, and open the builder as an interviewer
- [ ] The full automated suite passes (`pnpm --filter @repo/shared test`, `pnpm --filter api test`), and `pnpm lint`, `pnpm check-types` and `pnpm build` pass
- [ ] The schema doc matches the code: question types, answer shape, Preset key and catalog rules, and its "Later features" line about structured experience is updated (the types it mentions as pending are now built, except the separate `number`, `date` and `url` ticket)
- [ ] The architecture notes in the repo's rule files (shared package and web) describe the group type, the Preset key catalog, the Presets menu, the group step and the candidate sheet rendering
- [ ] The glossary still matches the words used in the UI copy; any mismatch is fixed in whichever is wrong
- [ ] A short list of anything found along the way that the spec did not anticipate is written to this file under "## Findings", or the section states that there was none
