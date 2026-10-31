# 06: Manager edits rules on the Settings tab

**What to build:** A fourth Job tab, **Settings**, where a manager adds, edits and removes Screening rules, and where Rating Criteria now lives. This ticket's editor covers the choice-style types; ticket 07 adds number, date and text. Spec: `.scratch/screening-rules/spec.md` ("Web").

- **Tab:** `/settings` added to the Job tabs following the link-tab pattern, with `<ViewTransition>` in the page and never in the layout. Read `apps/web/AGENTS.md` and the installed Next docs first.
- **Sections:** Screening rules (a per-question editor) and Rating Criteria (moved from where it is today, behaviour unchanged).
- **Editor, this ticket:** pick a question, pick an outcome (reject or flag), and set the condition for yes/no, single-choice (accepted set, or excluded set) and multi-choice (any-of, none-of-required, all-of). Several rules per question are allowed. Save is one replace-all through the API; refused rules show their field errors. Only managers can edit; an interviewer sees no editor.
- A Job with no published form shows a message that the form comes first.

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] The Settings tab appears for the Job and survives reload, and the navigation animates like the other tabs
- [ ] Rating Criteria is on Settings and its old location no longer shows it; saving still works
- [ ] A manager adds, edits and removes yes/no, single-choice and multi-choice rules and sees them after reload
- [ ] API validation errors show against the right rule
- [ ] An interviewer cannot edit; a Job with no published form shows the empty state
- [ ] Works at phone width and in both themes
- [ ] Browser check recorded in the Answer; `.claude/rules/web.md` updated
- [ ] `pnpm lint` and `pnpm check-types` pass
