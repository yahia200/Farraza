# 07: Rule editor for number, date and text

**What to build:** The Settings editor handles the remaining question types, so a manager can screen on years, salary, availability and written answers. Spec: `.scratch/screening-rules/spec.md` ("User Stories" 5 to 7, 9, 10).

- **Number:** minimum, maximum, or range.
- **Date:** before or after, either a fixed date or relative to the submission date ("within N days").
- **Short and long text:** words any-of, all-of, none-of, entered as a list within the caps (20 words, 60 characters each), with a note that matching is whole-word and case-insensitive.
- Helper text on the editor that a skipped answer never fires a rule, so a manager marks the question required to enforce it.

**Blocked by:** 06.

**Status:** resolved

- [ ] A manager adds, edits and removes a rule of each new type and sees it after reload
- [ ] Both a minimum and a maximum can be set on one question as two rules
- [ ] Fixed and relative date rules are both creatable and display clearly
- [ ] The word list enforces the caps in the UI and shows API errors if refused
- [ ] The skipped-answer helper text is visible
- [ ] Works at phone width and in both themes; browser check recorded in the Answer
- [ ] `.claude/rules/web.md` updated; `pnpm lint` and `pnpm check-types` pass

## Answer

Number, date, short and long text rules are editable on the Settings tab.

- Shared (`screening-rule-editor.ts`, tests first): `SCREENABLE_TYPES`, `defaultCondition` (number: at least 0; date: after the day of applying; text: any of, no words), `conditionOps` wording, and `setConditionOp` reshaping number conditions.
- Web: `condition-inputs.tsx` (`NumberConditionEditor`, `DateConditionEditor`, `WordsConditionEditor`), wired into `ConditionEditor`. Min and max on one question are two rules. The word list enforces the caps (input `maxLength`, Add disabled at 20) and API errors show on the rule card as before.
- The skipped-answer helper text already existed from ticket 06 (`RuleCard`, shown for optional questions); kept as the single copy.
- Browser check (phone width, both themes, reload round trip) was deferred: the worktree has no `.env` files, so the orchestrator checks it from the main folder. The browser checkboxes above are left unticked on purpose.
- `pnpm lint`, `pnpm check-types`, `pnpm --filter @repo/shared test` and `npx tsc --noEmit` in `apps/web` pass.
