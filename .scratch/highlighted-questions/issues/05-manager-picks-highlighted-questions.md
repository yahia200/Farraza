# 05: A manager picks the Highlighted questions

**What to build:** On the candidates page, a person who can manage jobs opens a popover from a ghost icon button and ticks up to three Questions; each change saves at once. Spec: `.scratch/highlighted-questions/spec.md` ("Web").

- A `Button` `variant="ghost"` with a settings icon and an accessible name (for example "Choose questions to show") beside `CandidatesViewToggle`. It opens a shadcn `Popover` of `Checkbox` rows, one per highlightable Question of the **latest published form**, in form order, ticked from the Job's `highlightedQuestionKeys`. Check `apps/web/components/ui/` for `popover` and `checkbox`; add missing ones with `pnpm --filter web exec shadcn add <name>`, and read the Base UI docs under `apps/web/node_modules/@base-ui/react/docs/` first.
- Each toggle calls a new Server Action (`apps/web/app/actions/`) that PUTs the whole new list through `lib/api.ts` (ticket 02), returns `ActionFailure` on failure, toasts the failure, and revalidates the cached board and the job so the lists update without a reload. At three ticked, the remaining boxes are disabled with a line saying why.
- Shown only when `canManageJobs(role)`; interviewers see the Highlighted answers but no button. A Job with no published form shows no button. The Questions come from the published form; if the DAL only exposes the draft, add a published read.
- Glossary wording only; final copy is yours to choose.

**Blocked by:** 02. (Ticket 04 makes the effect visible, so verify together if 04 has landed.)

**Status:** needs-triage

- [ ] The button appears for owner, admin and recruiter, not for interviewers, and not for a Job with no published form
- [ ] The popover lists only highlightable Questions of the latest published form, in form order, with the current choice ticked
- [ ] Ticking or unticking saves immediately and the table and cards update without a reload
- [ ] At three ticked the others are disabled with an explanation; unticking one re-enables them
- [ ] A failed save toasts and the checkboxes return to the saved state
- [ ] The choice persists after a reload and is the same for another member
- [ ] Keyboard and screen-reader use works (focus, names, Escape closes), following Base UI's docs
- [ ] Checked in the browser pane at desktop and phone width, as an owner and as an interviewer (use a `<name>.localhost:3000` second login per `.claude/rules/web.md`); no console errors
- [ ] `.claude/rules/web.md` updated for the picker and the action
- [ ] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer
