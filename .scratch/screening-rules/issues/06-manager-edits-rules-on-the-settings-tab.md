# 06: Manager edits rules on the Settings tab

**What to build:** A fourth Job tab, **Settings**, where a manager adds, edits and removes Screening rules, and where Rating Criteria now lives. This ticket's editor covers the choice-style types; ticket 07 adds number, date and text. Spec: `.scratch/screening-rules/spec.md` ("Web").

- **Tab:** `/settings` added to the Job tabs following the link-tab pattern, with `<ViewTransition>` in the page and never in the layout. Read `apps/web/AGENTS.md` and the installed Next docs first.
- **Sections:** Screening rules (a per-question editor) and Rating Criteria (moved from where it is today, behaviour unchanged).
- **Editor, this ticket:** pick a question, pick an outcome (reject or flag), and set the condition for yes/no, single-choice (accepted set, or excluded set) and multi-choice (any-of, none-of-required, all-of). Several rules per question are allowed. Save is one replace-all through the API; refused rules show their field errors. Only managers can edit; an interviewer sees no editor.
- A Job with no published form shows a message that the form comes first.

**Blocked by:** 02.

**Status:** resolved

- [ ] The Settings tab appears for the Job and survives reload, and the navigation animates like the other tabs
- [ ] Rating Criteria is on Settings and its old location no longer shows it; saving still works
- [ ] A manager adds, edits and removes yes/no, single-choice and multi-choice rules and sees them after reload
- [ ] API validation errors show against the right rule
- [ ] An interviewer cannot edit; a Job with no published form shows the empty state
- [ ] Works at phone width and in both themes
- [ ] Browser check recorded in the Answer; `.claude/rules/web.md` updated
- [ ] `pnpm lint` and `pnpm check-types` pass

## Answer

Built: the Settings tab (`/settings`, link-tab with `<ViewTransition>` in the page), the Screening rules editor (yes/no, single and multiple choice; reject or flag; several rules per question; one replace-all save with API errors shown on the right rule; interviewers get a note, not an editor; a Job with no published form gets a "form comes first" message with a link), and Rating Criteria moved to Settings as an inline checklist (candidates page no longer shows it; same action, now also revalidating the settings path). The editor's pure logic is in `packages/shared/src/screening-rule-editor.ts` with 10 tests. `.claude/rules/web.md` is updated.

Checked: `pnpm --filter @repo/shared test` (537 pass), `tsc --noEmit` in `apps/web` after `next typegen`, `pnpm lint` (no errors; the one warning this ticket introduced was fixed, two older ones remain in files not touched).

**Browser check: NOT done.** The worktree had no `apps/api/.env` or `apps/web/.env.local` (`.worktreeinclude` did not copy them), and copying them from the main folder was refused by the permission system, so neither dev server could start. Postgres was already running from the main folder's compose (port 5432), with `jobs.screening_rules` present. Still to check by hand: the tab animation and reload, add / edit / remove for each type and reload, a refused rule showing its error, an interviewer view, the no-form message, phone width and both themes, and the Rating Criteria save on Settings. So the browser-dependent checkboxes above are left unticked.
