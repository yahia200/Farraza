# 13: Verification pass and docs sweep

**What to build:** Prove Layer 3 works end to end in a real browser against the real API and local Ollama, and leave the documentation true. Nothing new is built here.

- Walk the whole path: save Requirements (with and without keywords), submit Applications with readable, unreadable and no CVs, see the states and bands on the sheet, use "Sort by score", stop and restart Ollama and click Re-check, and reach the Edit limit to see the lock.
- Check the Layer 2 behaviour is unchanged: "Missing must-have", Re-check, and the markers on the card, row and sheet.
- Check that no CV text, passage or raw number appears in any payload, page source or public route.
- Update the documentation: `docs/db-schema.md`, `.claude/rules/api.md` and `.claude/rules/web.md`, the documentation table and setup text in `CLAUDE.md`, the Layer 3 backlog entry, the notes file, the spec status line, and ADR-0008's status. Mark the cutoff-testing item done.
- List anything still open for the owner: the production embedder, the model licence, the placeholders that stayed placeholders.

**Blocked by:** 07 (submit queues scoring), 09 (sheet shows bands and states), 10 (sort by score), 11 (Re-check second stage and model-change re-embed), 12 (cutoff testing).

**Status:** ready-for-agent

- [ ] The full path above is checked in a browser and screenshots are saved next to the tickets
- [ ] The public routes are checked for leaks, and a stopped Ollama never breaks a submit
- [ ] The documentation files above are updated and consistent with the code
- [ ] ADR-0008 and the spec are marked with their final status
- [ ] `pnpm lint`, `pnpm check-types`, `pnpm --filter @repo/shared test` and `pnpm --filter api test` pass
