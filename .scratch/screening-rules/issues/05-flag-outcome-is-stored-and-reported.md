# 05: Flag outcome is stored and reported

**What to build:** A rule with outcome flag marks an Application without moving it, and the API reports the flags. Spec: `.scratch/screening-rules/spec.md` ("Database", "API"); glossary **Application Event**.

- **Storage:** `applications.flags`, `jsonb`, NOT NULL, DEFAULT `'[]'`, CHECK array: `[{ ruleId, questionKey, questionLabel, reason }]`. Reasons are stored text, so later edits never rewrite them. (Spec proposal; the owner approved the column over reading events.)
- **Events:** `application_events.type` gains `flagged`, with the fired rules and reasons in `data`.
- **Submit:** flags are recorded in the same transaction. If a reject also fired, the Application is rejected and any flags it also tripped are still stored and written as a `flagged` event.
- **Payloads:** board and list payloads carry each Application's flags; the detail payload carries the reasons. The public routes return none of it.

**Blocked by:** 04.

**Status:** resolved

- [x] A flag-only outcome leaves the Application in its starting stage and status, with `flags` set and a `flagged` event
- [x] Reject plus flag: rejected, with both `auto_rejected` and `flagged` events and the flags stored
- [x] No fired rule: `flags` is `[]` and no `flagged` event
- [x] Board, list and detail payloads carry the flags as described; the web types mirror them
- [x] No public route returns flags or reasons (tested)
- [x] Editing or deleting a rule later does not change stored flags
- [x] Contract files and snapshots committed; `docs/db-schema.md` and `.claude/rules/api.md` updated
- [x] Service specs on the in-memory fakes cover every case
- [x] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass
