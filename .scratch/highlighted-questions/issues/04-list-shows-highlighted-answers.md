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
