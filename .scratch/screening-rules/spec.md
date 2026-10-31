Status: draft (for owner review, not yet ticketed)

# Screening rules (candidate matching, Layer 1)

Related: the design notes (`.scratch/candidate-matching/layers.md`, Layer 1), the backlog item (`docs/feature-backlog.md`), ADR-0005 (`docs/adr/0005-screening-rules-on-the-job.md`), the glossary entries **Screening rule**, **Application Event** and **Criterion** (`GLOSSARY.md`), the Rating Criteria spec (`.scratch/ratings/spec.md`, the pattern the Job-level list follows), `findKnockout` (`packages/shared/src/answers.ts`), the rule properties (`packages/shared/src/form-fields.ts`) and the submit path (`apps/api/src/applications/applications.service.ts`).

## Problem Statement

Auto-reject rules exist only for `yes_no` and `single_select`, only reject, and live inside the form version, so changing one means publishing a new form. A manager cannot say "flag anyone with under 5 years" or "reject unless they know Postgres" and cannot soften a rule into a marker a reviewer decides on.

## Solution

A manager sets **Screening rules** for a Job on a new **Settings** tab, each about one form question with an outcome of reject or flag. They are checked once, when an Application is submitted. A reject sends it to the Rejected stage as today. A flag leaves it in place and shows a marker with the reason on the board card, the table row and the candidate sheet. The reason is generated from the rule and the answer, for example "Years of experience was 2, minimum 5", and only Members see it. The Settings tab also hosts Rating Criteria, moved from where it sits today.

## User Stories

1. As a manager, I want to add a Screening rule to a question on my Job, so that unsuitable answers are caught without reading every Application.
2. As a manager, I want each rule to either reject or flag, so that hard requirements reject and soft ones only mark.
3. As a manager, I want to reject unless a single-choice answer is in an accepted set, so that I can list what is acceptable instead of what is not.
4. As a manager, I want any-of, none-of-required and all-of rules on a multi-choice question, so that I can require skills or exclude options.
5. As a manager, I want minimum, maximum and range rules on a number question, so that I can screen on years or salary.
6. As a manager, I want before or after rules on a date question, fixed or relative to the submission date, so that "available within 60 days" works.
7. As a manager, I want any-of, all-of and none-of word rules on a text question, matched as whole words regardless of case, so that I can screen on what someone wrote.
8. As a manager, I want a yes/no rule to behave as it does today, so that nothing I already rely on changes.
9. As a manager, I want a skipped optional question never to fire a rule, so that I control enforcement by marking the question required.
10. As a manager, I want several rules on one question, so that I can set both a minimum and a maximum.
11. As a manager, I want editing a rule to leave past Applications untouched, so that history stays honest.
12. As a manager, I want to save rules on a draft, open or closed Job, so that I can prepare before publishing.
13. As a manager, I want publishing a form version that drops a question a rule uses to be blocked with a clear message, so that no rule silently stops working.
14. As a reviewer, I want a flagged Application marked on the board card, the table row and the sheet, so that I notice it.
15. As a reviewer, I want the sheet to list each flag's reason, so that I know why it was marked.
16. As a reviewer, I want an auto-rejected Application to show which rules fired, and any flags it also tripped, so that I see everything that applied.
17. As a recruiter, I want a `flagged` event and a reason on the `auto_rejected` event in the Application's history, so that the audit trail covers both outcomes.
18. As an applicant, I want rules and reasons to be invisible to me, so that I cannot game the form.
19. As a manager, I want Rating Criteria on the same Settings tab, so that Job configuration is in one place.
20. As a maintainer, I want the rule schemas and the evaluator in `@repo/shared`, so that the API and the web run the same code.

## Implementation Decisions

The behaviour is settled (grilling session, 2026-10-31); the names below are proposals to confirm against `apps/api/prisma-8.md` and the existing contract.

**Shared (`@repo/shared`, pure and tested)**

- A rule is `{ id (uuid), questionKey (uuid), outcome: 'reject' | 'flag', condition }` where `condition` is a Zod discriminated union on the question type. Conditions: `single_select` (in-set, not-in-set), `multi_select` (any-of, none-of-required, all-of), `number` (min, max, range), `date` (before or after, fixed or relative to submission, `Temporal.PlainDate` as `dates.ts` does), `short_text`/`long_text` (words any-of, all-of, none-of), `yes_no` (the answer to match). A parse step checks a rule list against the Job's current form (type match, unknown option ids, unknown question keys) and returns `<path>` errors like the other validators.
- Caps: at most 20 rules per Job, at most 20 words per word rule, each at most 60 characters (chosen limits, easy to raise).
- Word matching is whole-word and case-insensitive. There is no regex in this slice (backlog, low priority).
- `evaluateScreeningRules(rules, fields, answers, submittedOn)` replaces `findKnockout`: it returns every fired rule with its generated reason. The caller applies the outcome: any reject sends the Application to Rejected; otherwise the flags are recorded. A blank answer never fires a rule. The evaluator and the rules are server-side only; `toPublicFields` stays as is and the public form no longer carries rule properties at all.
- Remove `rejectWhen` and `rejectOptionIds` from the field `config` schemas, along with the "no rules in groups" checks that guarded them. The parser strips the two retired properties from stored form versions rather than failing on them.

**Database**

- `jobs.screening_rules`: `jsonb`, NOT NULL, DEFAULT `'[]'`, CHECK it is an array, no FK (add it to the no-FK list in `docs/db-schema.md` §7).
- Where the stored flags go is open for the ticket: a `flags` `jsonb` column on `applications` (`[{ ruleId, questionKey, questionLabel, reason }]`, default `'[]'`) is the proposal, because the board and table need them on every card without reading events. Reasons are stored text, so renamed questions or edited rules never rewrite them.
- `application_events.type` gains `flagged`; `data` holds the fired rules and reasons. `auto_rejected` keeps its name and gains the reasons in `data`.
- Existing test jobs are cleared; no data migration. Changes go through `contract.prisma`, `prisma contract emit` and `prisma db update`; commit the emitted files and any snapshots (CLAUDE.md, "Database"). Update `docs/db-schema.md` too.

**API (`apps/api`)**

- `PUT companies/:companySlug/jobs/:jobSlug/screening-rules` with `{ rules }`, in the jobs module, authorized with `JobPolicy` `update`, any Job status, one unconditional replace (last-write-wins like `rating_criteria`; say so in a comment). Validated against the Job's current form; a Job with no published form accepts only an empty list. The Job payload gains `screeningRules`.
- Publishing a form version fails with field errors when it drops a question a rule points to, or changes its type or removes an option a rule uses.
- Submit (`applications.service.ts`): replace the `findKnockout` call with the evaluator, set stage and status from the outcome, write the `applied` event, then `auto_rejected` and/or `flagged`, in the same transaction as today.
- The board and list payloads carry each Application's flags; the detail payload carries the reasons. The public routes never return rules, flags or reasons (test it).

**Web (`apps/web`)**

- A fourth Job tab, **Settings** (`/settings`), added to `job-tabs.tsx` following the link-tab pattern, with `<ViewTransition>` in `page.tsx` and never in the layout. Two sections: Screening rules (a per-question rule editor, with helper text that a skipped answer never fires a rule) and Rating Criteria (moved from its current place).
- Remove the per-field rule controls from the form builder.
- Flag marker on the board card, the table row and the sheet; the sheet lists each reason. No "flagged only" filter yet.

## Testing Decisions

Test through public behaviour. `@repo/shared`: the evaluator per type and condition, blank answers, reject-over-flag, reasons, the cap and validation errors, and that stored legacy `config` still parses. API: a service spec in the `jobs.service.spec.ts` style with the in-memory fake repository, for saving rules, the form-publish block, submit outcomes (reject, flag, both, none), events, and that no public route returns rules or flags. Web: the editor's per-type condition forms and the marker.

## Out of Scope

Move-to-stage outcome, `repeating_group` and `url` rules, regex matching, re-running rules on existing Applications, a "flagged only" filter, guarding against screening on protected attributes (a decision, not an omission), any use of the CV (Layer 2).

## Suggested slices

1. Shared schema and evaluator (replaces `findKnockout`), with tests.
2. Database and API: `screening_rules`, the `PUT`, the publish block, and submit using the evaluator (reject only, so behaviour matches today).
3. Flag outcome: stored flags, the `flagged` event, and the flag data in the board, list and detail payloads.
4. Settings tab, the rule editor, and moving Rating Criteria in; remove the field-level controls.
5. Flag markers on the board card, table row and sheet.
