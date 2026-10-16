# 02: Recruiter sets a job form's CV mode (off, optional, required)

**What to build:** A recruiter can choose whether a job's form asks for a **CV**: off, optional or required. The setting lives on the form version, so changing it after publishing creates a new version like any other edit. Existing published versions default to off and new drafts for a new job start at optional. The form builder shows a "CV" card above the questions with a three-way toggle and a note that CVs are PDF or DOCX up to 5 MB; interviewers see it read-only. The public job payload exposes the mode. Applicants see no change yet. See ADR-0002 and the spec's Implementation Decisions (Domain model, Persistence).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The contract gains the `files` table as planned in the schema doc (with a declared duration column) and a CV mode column on form versions, as text with a CHECK; contract artifacts are re-emitted and the dev database updated.
- [ ] `docs/db-schema.md` matches the contract.
- [ ] The shared form schemas carry the CV mode; tests cover valid and invalid values.
- [ ] Saving a draft and publishing persist the mode; editing after publish creates a new draft version that keeps it.
- [ ] The builder shows the CV card with a three-way toggle group; interviewers see it read-only; the unsaved-changes backup still works.
- [ ] The public job payload includes the CV mode.
- [ ] Existing published forms read back as off.
