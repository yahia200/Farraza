# 05: A manager picks a Job's rating Criteria

**What to build:** A manager chooses up to five Criteria for a Job from a popover beside the existing Highlighted questions settings. Spec: `.scratch/ratings/spec.md` ("Web: Picker"). Model it on the Highlighted questions picker (`.scratch/highlighted-questions/issues/05-manager-picks-highlighted-questions.md` and its Answer).

- **Server Action** in `app/actions/` calling `PUT .../rating-criteria` through `lib/api.ts`; returns `ActionFailure` on failure; revalidates the cached board and the job.
- **Picker:** a ghost icon `Button` with an accessible name (for example "Choose rating criteria"), a `Popover` of `Checkbox` rows, one per catalog Criterion with its label, in catalog order; each toggle saves the whole list at once; at five ticked the rest are disabled with a line explaining the limit; shown only when `canManageJobs(role)`. Check `components/ui/` first, add components with `pnpm --filter web exec shadcn add <name>` if missing (`.claude/rules/web.md`).
- Copy uses the glossary words (Criterion, Rating).

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] A manager ticks one, then five, and the sixth is blocked with an explanation
- [ ] Each tick saves at once and survives a reload
- [ ] An interviewer doesn't see the button
- [ ] A Job with none ticked looks the same as before
- [ ] Phone-width layout checked in the browser, and what was checked recorded
- [ ] `.claude/rules/web.md` updated
- [ ] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer
