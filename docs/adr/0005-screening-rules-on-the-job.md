# Screening rules live on the Job, not on the form field

Status: accepted

Screening rules (reject or flag an Application from one answer) used to be properties of a form field (`rejectWhen`, `rejectOptionIds`), so they were part of the immutable form version. We store them instead as a Job-level list, `jobs.screening_rules`, keyed by question key and replaced whole by one `PUT`, the same shape as `jobs.rating_criteria`. Rules are evaluated once at submit and the result is stored on the Application, so editing a rule never changes past Applications.

Considered options:

- **Keep rules on the field in the form version** — nothing to migrate, but every reworded rule or new condition would publish a new form version, and the many new rule types (ranges, relative dates, word lists) would bloat field `config`.
- **A Job-level list keyed by question key** — chosen. Rules change without a new version, and they can never reach the apply page because the public form no longer carries them. Question keys are stable across versions, which is what lets the list point at a question.

Consequences: publishing a form version that drops a question a rule points to is blocked until the rule is removed. Only test jobs existed when this changed, so the old field-level rules were deleted rather than migrated; old form versions keep their stored JSON and the parser strips the two retired properties.
