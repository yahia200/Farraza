Status: resolved

# Highlighted questions on the candidate list

Related: the glossary entry **Highlighted question** (`GLOSSARY.md`, Forms), ADR-0004 (`docs/adr/0004-repeating-group-as-generic-question-type.md`: leaf questions, Repeating groups), the question-types spec (`.scratch/question-types/spec.md`: the number, date and URL answers this spec formats), and the glossary terms Application, Question, Repeating group and Stage.

## Problem Statement

To compare candidates on an answer that matters for a job, such as notice period, years of experience or "Can you work on site?", a reviewer must open every Application in the side sheet one by one. The candidates table shows only name, email, stage, status and applied date, and the board card shows only the name. Every extra click per candidate adds up when a job has dozens of Applications.

## Solution

A Job gets up to three **Highlighted questions**: single-answer Questions whose answer is shown on every Application in the Job's candidate list. In the table each one is a column after Candidate. On the board each one is a small label-over-answer block on the card, under the candidate's name. A person who can manage jobs picks them from a popover opened by a ghost icon button (settings icon) beside the Table/Board toggle; everyone who can view the candidates sees the result. The choice is saved on the Job, not per user.

The API sends each answer as display-ready text, already resolved against the form version that Application was submitted with, so older Applications keep showing the labels their applicant saw.

## User Stories

1. As a recruiter, I want to choose which Questions show on the candidate list, so that I can compare candidates on what matters for this job without opening each one.
2. As a recruiter, I want to choose up to three, so that the table and the cards stay readable.
3. As a recruiter, I want only Questions that have a single answer to be offered (text, long text, single or multiple choice, yes/no, number, date and link), so that I'm not offered a Repeating group or a file that can't be summed up in a line.
4. As a recruiter, I want to open the choice from a settings button next to the view toggle, so that I find it where I look at candidates.
5. As a recruiter, I want a change to apply as soon as I tick or untick a Question, so that I don't have to find a Save button.
6. As a recruiter, I want the picker to stop me at three and say why, so that I understand why the other checkboxes are off.
7. As a recruiter, I want the choice to be shared by everyone viewing the Job, so that the team looks at the same list.
8. As a recruiter, I want the picker to list the Questions of the latest published form, so that I'm choosing among what applicants are asked now.
9. As a reviewer, I want each Highlighted question as a column in the table after the candidate's name, with the question's text as the header, so that I can scan down the answers.
10. As a reviewer, I want a long header or answer cut to one line with the full text on hover (headers) or in the sheet (answers), so that one verbose Question doesn't break the table.
11. As a reviewer, I want each Highlighted question on the board card as the question in small type over its answer, so that the card still reads on a narrow column.
12. As a reviewer, I want an unanswered Highlighted question shown as "—", so that I can tell it from an empty cell that failed to load.
13. As a reviewer, I want a multiple-choice answer joined with commas, a yes/no as "Yes" or "No", a number as entered (0 counts as an answer), and a date in the long readable form the sheet uses, so that the list and the sheet say the same thing.
14. As a reviewer, I want a link answer shown as plain text, not a link, so that clicking a row's text never takes me off the page by accident.
15. As a reviewer, I want an Application submitted against an older form to show its own applicant's option labels, so that a relabelled option doesn't rewrite history.
16. As a reviewer, I want an Application whose form version lacks a Highlighted question to show "—", so that an older Application is not an error.
17. As a reviewer, I want a Highlighted question to disappear from the list once the latest published form no longer asks it, so that I'm not looking at a column of "—".
18. As an interviewer, I want to see the Highlighted questions but not the button that changes them, so that I can't change the team's view by mistake.
19. As a recruiter, I want a Job with no Highlighted questions to look exactly as it does today, so that nothing changes until I opt in.
20. As a maintainer, I want the API to send only the Highlighted answers, trimmed to a short length, so that a list every member loads doesn't carry long free-text answers or personal data.
21. As a maintainer, I want the text formatting rules in one place used by both the list and the sheet, so that they can't drift apart.
22. As a maintainer, I want the rules about which Questions can be highlighted in `@repo/shared`, so that the picker and the API agree because they run the same check.

## Implementation Decisions

Every decision here was settled with the owner: the grilling session settled the concept, storage, payload and layout, and the owner then confirmed the three details the spec had proposed (the dedicated route, reading each distinct form version once, and the keyed `highlights` map).

**Concept and rules (all in `@repo/shared`, pure and tested)**

- `HIGHLIGHT_LIMIT = 3`. A Question is highlightable when it is a top-level Question of type `short_text`, `long_text`, `single_select`, `multi_select`, `yes_no`, `number`, `date` or `url`. `repeating_group`, any sub-question of a group, and `file` are not. Export a predicate for this (for example `isHighlightable(field)`) and a function that lists the highlightable Questions of a form in form order.
- A Zod schema for the stored list: an array of at most `HIGHLIGHT_LIMIT` unique UUID strings (`z.strictObject` for the request body that wraps it, per the API conventions). Whether each key exists in the latest published form is not a schema concern (the schema doesn't have the form). A pure function takes the keys and the form's fields and returns the keys that are valid, or the errors, with `<index>` paths like the other validators. The API service calls it.
- Display order is the form's order, never the order the keys were stored or ticked.
- Text formatting for single-answer Questions moves into `@repo/shared` (option id to label, `Yes`/`No`, `String(number)`, the long date, a multi-select's labels, `Unknown option` for an id the version doesn't have). The web app's `formatAnswer`/`formatLeaf` (`apps/web/components/dashboard/candidates/format-answer.ts`) call it for the sheet; the API calls it for the list. This includes moving `formatIsoDate` (`apps/web/lib/format.ts`: `Temporal.PlainDate.from(value).toLocaleString('en-US', { dateStyle: 'long' })`, fixed locale) next to `dates.ts`. `@repo/shared` already uses plain `Temporal` with no polyfill (Node >= 26 on the server, the web app's polyfill in browsers); keep that. The web `formatAnswer` keeps its extras for the sheet (a link as `LinkAnswer`, groups, files). The exact exported signature is left to the implementer; it must be tested.
- Highlight text for the list: the shared formatter's text with a multi-select joined by `", "`, a link as the plain trimmed text, `null` when there is no answer (the web shows `—`), and cut at 200 characters (count characters, not UTF-16 units, so a surrogate pair isn't split) with `…` appended when cut. The 200 limit is a constant in `@repo/shared`. The sheet always shows the full answer.

**Database**

- `jobs.highlighted_question_keys`: `jsonb`, NOT NULL, DEFAULT `'[]'`, a CHECK that `jsonb_typeof(...) = 'array'` (the pattern `form_versions.fields` already uses). Changes go through `apps/api/src/prisma/contract.prisma`, then `pnpm --filter api exec prisma contract emit` and `prisma db update` (CLAUDE.md "Database"). Commit `contract.json`, `contract.d.ts`, and any new snapshot files under `apps/api/migrations/`. Read `apps/api/prisma-8.md` for how a default and a JSON column are written in the contract; do not rely on older Prisma knowledge.
- The selection cannot live on `form_versions`: published versions are immutable (`docs/db-schema.md` §3.6). It holds Question keys with **no FK** (the keys live inside a JSONB array, so Postgres could not enforce one anyway); add it to the list of columns without an FK in `docs/db-schema.md` §7.
- A stored key can go stale (the latest published form no longer has the Question, or it is no longer highlightable). Stale keys are **not** removed at publish. They are filtered out every time the list is built, and the next save of the picker replaces the whole list, so they disappear from the column then. (Owner decision.)
- Writes replace the whole list in one statement. This is a deliberate exception to the "conditional writes" convention in `.claude/rules/api.md`: it is a preference, and two people saving at once is last-write-wins with no data lost. Say so in a code comment.

**API (`apps/api`)**

- A dedicated route (confirmed by the owner), `PUT companies/:companySlug/jobs/:jobSlug/highlighted-questions` with body `{ keys: string[] }`, rather than adding to `PATCH :jobSlug`. Reason: `updateJobSchema` is title and description only, and this change needs the latest published form to validate against, which is a service concern. It lives with the jobs module (controller, service, repository, DTO re-exporting a shared schema, as in the existing layering). It authorizes with `JobPolicy` `update` (the `canManageJobs` roles), so interviewers get 403. It returns the saved list. The service loads the latest published form (`FormsRepository.findLatestPublished`, `apps/api/src/forms/forms.repository.ts`); with no published form it answers 409 ("Publish the form first"), and with keys that fail the shared check it answers 400 `{ message, errors: [{ path, message }] }`.
- The Job payload returned by `GET .../jobs/:jobSlug` (and the list, if it shares the type) gains `highlightedQuestionKeys: string[]`, so the web page knows the current selection. The web `Job` type mirrors it.
- The board (`GET .../jobs/:jobSlug/applications`, `PipelineService`, `PipelineRepository.findCards`) answers `{ columns, highlightedQuestions }`, where `highlightedQuestions` is the filtered, form-ordered list of `{ key, label }` from the **latest published** form (the table headers and the card's labels), and each card gains `highlights: Record<string, string | null>` keyed by Question key, with display-ready text or `null`.
- Each Application's text is resolved against **its own** form version: find that version's Question with the same key, and if there isn't one or it is not highlightable, the value is `null`. `findCards` today only joins the candidate; it must now also read each row's `answers` and `formVersionId`. Don't `include('formVersion')` per row, which repeats the whole `fields` JSONB on every row (confirmed by the owner); fetch the distinct form versions once by id and look the Question up in them. Confirm what the Prisma 8 ORM supports for narrowing columns in `apps/api/prisma-8.md` before choosing the exact query. With no Highlighted question left after filtering, skip reading answers altogether and send `highlights: {}`.
- The board and the detail call use the same access check as today (membership plus job lookup, no policy action), so interviewers see highlights. Only the answers to Highlighted questions leave the API; nothing else about answers changes, and `GET .../applications/:id` is untouched.

**Web (`apps/web`)**

- `getPipelineBoard` (`lib/dal.ts`, `'use cache: private'`) returns the columns plus `highlightedQuestions`; `PipelineCard` and `ApplicationSummary` gain `highlights`. The new Server Action (`app/actions/`) calls the new route through `lib/api.ts`, returns `ActionFailure` on failure like the other actions, and revalidates the cached board and the job so the new choice shows without a reload.
- **Picker:** a `Button` `variant="ghost"` with a settings icon (and an accessible name such as "Choose questions to show") beside `CandidatesViewToggle`, opening a shadcn `Popover` of `Checkbox` rows, one per highlightable Question of the latest published form, in form order. Check `components/ui/` for `popover` and `checkbox` and add with `pnpm --filter web exec shadcn add <name>` if missing (`.claude/rules/web.md`). Each toggle sends the whole new list at once. At three ticked, the rest are disabled with a line explaining the limit. Show it only when `canManageJobs(role)`. A Job with no published form shows no button (the sheet has nothing to list). The picker's Questions come from the latest published form; if the existing DAL only exposes the draft, add a published read; do not reuse a draft.
- **Table:** `columns.tsx` builds the Highlighted columns from `highlightedQuestions`, after Candidate and before Stage; header = the Question's latest text, truncated, full text in a tooltip; cell = the answer clamped to one line, or `—`. Display-only: `enableSorting: false`, no filter. `data-table-features.ts` already types the row; the columns must be built per render because the set varies per Job. **Warning:** TanStack Table v9 columns are created with `createColumnHelper`; read the `.d.ts` in `node_modules/@tanstack/table-core` for a dynamic column list instead of assuming the v8 API.
- **Board card:** under the name, a vertical list of blocks, each the question text in small muted type above the answer clamped to two lines (`—` when null); the "Move to stage" select stays at the bottom. No Highlighted questions: the card is unchanged. The card is currently being edited in the working tree (the email/date line and the drag preview `TODO(human)` in `candidate-card.tsx` are in flux); build on whatever is there rather than restoring either.
- Keep user-facing copy to the glossary words (Question, Application, Stage). Don't call the feature "columns" in the UI: say "Questions shown in the list" or similar. Final wording is left to the implementer.

**Docs**

- `docs/db-schema.md`: the `jobs` table (§3.5), the no-FK list and the rules (§7), and the board payload if it is described. `.claude/rules/api.md` (the jobs, pipeline and shared notes) and `.claude/rules/web.md` (the candidates page, the picker, the table columns, the card). `GLOSSARY.md` already has **Highlighted question**. No ADR: the decision is cheap to reverse and not surprising.

## Testing Decisions

- A good test checks external behaviour through the public functions, never internals, in the existing styles: API specs test a service through its public methods with the real service and policies on an in-memory fake repository (`src/jobs/jobs.service.spec.ts`, `src/pipeline` specs) with no database; `@repo/shared` tests the pure functions.
- **`@repo/shared`:**
  - `isHighlightable` for each of the ten question types and for a sub-question; the highlightable list is in form order.
  - The key check: accepts a valid list; refuses more than three, duplicates, non-UUIDs, a key not on the form, a key of a group, a sub-question or a file.
  - The text formatter, one case per type: a single choice becomes its label and an unknown option id is `Unknown option`; yes/no; `0` stays `0`; a date reads like `February 5, 2026`; a multi-select joins with `, `; a missing answer is `null`; a link stays plain text; text longer than 200 characters is cut with `…`, and a surrogate pair at the cut isn't split.
  - The sheet's `formatAnswer` still returns what it did (its tests, if any, are the guard for the move).
- **API (fake repository):**
  - Saving: a manager saves valid keys; an interviewer gets 403; a job with no published form is 409; keys not on the latest published form, over the cap, or of an ineligible type are 400 with `errors` paths; saving replaces the previous list.
  - Board: with nothing highlighted, `highlights` is empty and answers aren't read; with highlights, each card carries only those keys, formatted; an Application on an older version resolves option labels from its own version; an Application whose version lacks the Question gets `null`; a stored key the latest published form no longer has is left out of both `highlightedQuestions` and every card; `highlightedQuestions` is in form order with the latest labels; long text is cut at 200.
  - Tenant isolation: another company's job is 404 for save and board, as for the other job routes.
- **Web** has no test runner and none is added. Verify in the browser (the project's dev server): pick one, then three, and see the fourth blocked; the table columns and the card blocks update at once; reload and the choice persists; an interviewer sees the values but no button; a Job with no published form; a Question removed in a new published version disappears; an Application from an older version; a phone-width board and table. Record what was checked.

## Out of Scope

- Sorting, filtering or searching the list by a Highlighted question.
- Choosing the order of Highlighted questions (form order only).
- Highlighting a Repeating group, a sub-question or a file Question, or a rule for summarising them.
- A per-user or per-company choice of Highlighted questions, or defaults copied between Jobs.
- Showing Highlighted questions anywhere other than the table and the board card (the sheet already shows every answer in full).
- Rendering a link answer as a link in the list.
- Removing stale keys from the database at publish time.
- Reordering, resizing or hiding the table's built-in columns.
- A test setup for the web app.

## Further Notes

- Question keys are UUIDs that stay with a Question as the builder saves it, and every save sends the builder's whole `fields` list, so a Highlighted question keeps its key across form versions as long as the recruiter edits it in place and doesn't delete and re-add it. Confirm this against `form-builder.tsx` when implementing; the whole design depends on it.
- Suggested vertical slices, to make tickets from later: (1) the shared rules and formatter move, with tests; (2) the column, the save route and the Job payload; (3) the board payload; (4) the picker, the table columns and the card blocks; (5) docs and the browser check.
- Per the working agreement in `CLAUDE.md`, each ticket should name the doc it relied on for every library call (the `prisma-8.md` notes for the contract and queries, `node_modules/@tanstack/table-core` for dynamic columns, the Base UI docs under `apps/web/node_modules/@base-ui/react/docs/` for the popover and checkbox).
