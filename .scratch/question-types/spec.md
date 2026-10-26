Status: needs-triage

# Number, date and URL question types

Related: ADR-0004 (`docs/adr/0004-repeating-group-as-generic-question-type.md`), the repeating-groups spec (`.scratch/repeating-groups/spec.md`, which left these three types out of scope), and the glossary terms Question, Repeating group, Entry, Preset and Preset key.

## Problem Statement

Recruiters can only ask for text, a choice, a yes/no, a file or a repeating group. When they need a number (years of experience, expected salary), a date (available from, date of birth) or a link (portfolio, LinkedIn), they use a short text question and get whatever the applicant typed: "3 yrs", "next month", "linkedin dot com slash me". Nothing is checked, nothing can be compared, and a link can't be clicked on the candidate sheet. The Education and Experience Presets have the same problem: their years and dates are free text, which the repeating-groups work accepted only until these types existed.

## Solution

Three new question types, all usable at the top level of a form and as sub-questions inside a Repeating group:

- **Number**: the applicant enters a number. The recruiter can set a minimum, a maximum, and whether only whole numbers are allowed.
- **Date**: the applicant picks a calendar date, with no time. The recruiter can set an earliest and a latest date.
- **URL**: the applicant enters a web link. It must be an `http:` or `https:` address, and the candidate sheet shows it as a clickable link.

None of the three has auto-reject rules. The Education Preset's start and end year become number questions, and the Experience Preset's start and end date become date questions; the end date is optional so a current job can be left open.

## User Stories

1. As a recruiter, I want to add a Number question to a form, so that I get a value I can compare instead of free text.
2. As a recruiter, I want to set a minimum and a maximum on a Number question, so that an applicant can't enter an impossible value.
3. As a recruiter, I want to require whole numbers only, so that "years of experience" can't be 2.5 when I mean whole years.
4. As a recruiter, I want an error next to the setting when the minimum is higher than the maximum, so that I can fix it without guessing.
5. As a recruiter, I want to add a Date question to a form, so that "available from" is a real date.
6. As a recruiter, I want to set an earliest and a latest date on a Date question, so that a start date can't be in the distant past.
7. As a recruiter, I want an error next to the setting when the earliest date is after the latest, so that I can fix it without guessing.
8. As a recruiter, I want to add a URL question to a form, so that I collect a portfolio or profile link that works.
9. As a recruiter, I want all three types in the same "Add question" menu as the others, so that I find them without learning anything new.
10. As a recruiter, I want to use all three types inside a Repeating group, so that an Entry can hold dates and years.
11. As a recruiter, I want to make any of the three optional or required like every other question, so that I decide what blocks an application.
12. As a recruiter, I want no auto-reject rule offered on these types, so that I'm not misled into thinking one would work.
13. As a recruiter, I want the Education Preset to ask for start and end year as numbers, so that years are comparable across candidates.
14. As a recruiter, I want the Experience Preset to ask for start and end date as dates, so that I can see how long someone worked somewhere.
15. As a recruiter, I want the Experience end date to be optional, with help text saying to leave it blank for a current job, so that a current job has an honest answer.
16. As an interviewer, I want to see the three new question types in the builder read-only, so that I understand what applicants were asked.
17. As an applicant, I want a number box that only takes numbers, so that I can't mistype a unit into it.
18. As an applicant, I want a date picker, so that I don't guess a date format.
19. As an applicant, I want a link box that tells me if my link isn't a web address, so that I fix it before submitting.
20. As an applicant, I want to see the allowed range or the earliest and latest date before I hit an error, so that I know the limit up front.
21. As an applicant, I want an error next to the exact box that is wrong, including inside an Entry card, so that I know what to fix.
22. As an applicant, I want an optional question left blank to be skipped, so that I'm not forced to invent an answer.
23. As an applicant, I want `0` to count as a valid number answer, so that "0 years" isn't treated as skipped.
24. As a reviewing member, I want a number shown as the applicant entered it, a date in a readable form, and a link as a clickable link, so that I read the sheet at a glance.
25. As a reviewing member, I want a link to open in a new tab without giving the target site access to my session, so that clicking an applicant's link is safe.
26. As a maintainer, I want a link whose scheme isn't `http:` or `https:` refused on the server, so that a `javascript:` link can never reach the candidate sheet.
27. As a maintainer, I want the three types to reuse the existing leaf-question validation, so that they work inside groups with no group-specific code (as ADR-0004 promised).
28. As a maintainer, I want all the rules in the shared package, so that the builder, apply page and API agree because they run the same checks.
29. As a maintainer, I want date validation done with the JavaScript Temporal API, so that "2026-02-30" is refused rather than silently rolled into March.

## Implementation Decisions

**Shared package (`@repo/shared`), all rules**

- Three new question types join the existing seven: `number`, `date`, `url`. They carry the usual base properties (key, label, help text, `required`, Preset key). They join `leafFieldSchema`, so they are allowed inside a Repeating group, and they go through the same `checkLeafRules` and the same per-question answer check.
- **Number**: config `{ min: number | null, max: number | null, integerOnly: boolean }`. The schema refuses `min > max`. The answer is a JSON number. Non-finite values are refused. `0` is an answer (`isBlankAnswer` already treats only missing, `null`, blank text and an empty list as blank). With `integerOnly` the answer must be a whole number.
- **Date**: config `{ min: string | null, max: string | null }`, each an ISO `YYYY-MM-DD` date. The schema refuses a non-date and `min` after `max`. The answer is an ISO `YYYY-MM-DD` string, a calendar date with no time and no timezone. A string is valid only if `Temporal.PlainDate.from(value, { overflow: 'reject' })` accepts it and it round-trips to the same text (so `2026-2-5` and `2026-02-30` are both refused), then it is checked against `min` and `max` with `Temporal.PlainDate.compare`.
- **URL**: no config. The answer is trimmed and at most 2,048 characters (the same bound as `logo_url`), parsed with the platform `URL`, and accepted only if the scheme is `http:` or `https:`.
- None of the three has auto-reject rules; `findKnockout` ignores them like it ignores text questions. `toPublicFields` passes them through whole (no recruiter-only data).
- Preset key catalog (`preset-keys.ts`): `education.start_year` and `education.end_year` change type from `short_text` to `number`; `experience.start_date` and `experience.end_date` change from `short_text` to `date`. This breaks the file's append-only rule on purpose, **once**, because no form has been published yet (the project is still in development), so no stored form can fail to load. The header comment and ADR-0004 must say so, and the rule stands again from the next release. The `PresetQuestionType` copy in that file gains the three new type names.

**Temporal**

- Node 26 ships Temporal natively (checked: Node 26.12 has `Temporal.PlainDate`, and `{ overflow: 'reject' }` throws a `RangeError` for 2026-02-30; Node 25.5 has no `Temporal`). The repo's `engines` field and the Node version in `CLAUDE.md` move from `>=24` to `>=26`. The server needs no polyfill. Owner decision (2026-10-25, ticket 01 "Owner decisions"): `apps/web` alone loads `temporal-polyfill` for browsers that lack `Temporal`; `@repo/shared` never imports one.
- The installed TypeScript (6.0.3) has no Temporal lib in `node_modules/typescript/lib`, and the shared config's `lib` is `ES2022`/`ES2023`. Typing Temporal needs a decision during implementation (a types package, or a small local declaration of only what is used); record the choice and its docs reference in the ticket.
- **Browser risk (settled 2026-10-25: polyfill in the web app, see above).** `@repo/shared` also runs in the browser (the apply page and builder run the same checks). Temporal is not available in every browser yet (as of this writing, Safari lacks it). Options: do the date checks in the browser without Temporal and keep Temporal on the server only; load a polyfill in the web app; or accept the browser support as is. This spec does not choose. Ticket 01 must verify current browser support from MDN and put the options to the owner before code.

**Web app**

- Builder: three new cards in the "Add question" menu and the question card, with their config editors (min/max and a whole-numbers switch; earliest/latest date; none for URL). Read-only for interviewers like every other card.
- Apply page: a number input, a date input (the platform date picker), and a URL input, each with the shared validation's message next to the box, and the allowed range shown as hint text. The group step renders them in an Entry card with no group-specific code.
- Candidate sheet: number as entered, date in a readable form, URL as a link with `target="_blank"` and `rel="noopener noreferrer"`. The `format-answer` helper handles all three.
- Presets (`form-builder/presets.ts`): Education's year questions become `number` (whole numbers, 1950 to 2100); Experience's start and end become `date`, with the end date optional (`required: false`) and help text "Leave blank if this is your current job".
- Existing drafts that were built from the old text Presets in the dev database keep their `short_text` questions with the old keys and will fail the catalog check. They are deleted or re-inserted by hand; no migration code is written.

**Data and docs**

- Both the form's questions and the answers are JSONB, so no table or column changes. Confirm against the schema contract before starting.
- Update `docs/db-schema.md` (the question types table, answer shapes, the catalog rules, the Preset definitions), the shared and web architecture notes in `.claude/rules/api.md` and `.claude/rules/web.md` ("seven field types" becomes ten), `CLAUDE.md` (Node version), and the amended note in ADR-0004. The glossary needs no change: Question already covers the new types.

## Testing Decisions

- A good test checks external behaviour through the public functions, never internals: given a list of questions and submitted answers, assert what is returned (accepted answers, or path-and-message errors).
- **One automated seam: the public functions of the shared package** (`parseFormFields`, `parseAnswers`, `toPublicFields`, `findKnockout`), tested like the existing form-field and answer tests.
- Behaviours to cover:
  - Form validation: a valid question of each type; `min > max` for number and for date; a non-date `min`; an invalid sub-question inside a group; each type inside a group; each type with a Preset key of the catalog's (new) type, and a key on the wrong type.
  - Answer validation: number accepted, `0` accepted, below `min`, above `max`, not an integer when `integerOnly`, a string instead of a number, `NaN`/`Infinity`; date accepted, `2026-02-30`, `2026-2-5`, a non-string, before `min`, after `max`; URL accepted, trimmed, `javascript:`/`ftp:`/no scheme refused, over 2,048 characters; optional blank skipped for each; error paths in the `<groupKey>.<index>.<childKey>` form inside an Entry; blank-Entry dropping with `0` counting as an answer.
  - `findKnockout` ignores the three types.
- The web pieces have no test runner and none is added. They are verified in the browser: add each type, set limits, save, publish, apply (including inside an Education and an Experience Entry, with a wrong value in each), check the candidate sheet and the link, and check the read-only builder as an interviewer. Record what was checked.

## Out of Scope

- Auto-reject rules on the three types (a separate decision: it touches `findKnockout`, the builder and the ADR-0004 group limits).
- A time of day, a timezone, or a "month and year only" date. A month-only option could be added to the date config later without breaking stored answers.
- A unit or suffix on numbers (the question label says it).
- Currency or locale formatting of numbers; localized date display beyond what the browser provides.
- Candidate list columns, filters or search over these answers.
- New Preset keys or new Presets.
- Migrating drafts built from the old text Presets.
- A test setup for the web app.

## Further Notes

- The Preset retyping is a deliberate one-time exception to the append-only catalog, justified only by "nothing published yet". If anything has been published to any environment by the time this ships, switch to adding new keys instead and leave the old ones in place.
- Use the glossary words Question, Repeating group, Entry and Preset in UI copy and tickets; avoid "field" for what the user sees.
- `Temporal` docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal (read the `PlainDate` page for `from`, `compare` and the `overflow` option before implementing).
