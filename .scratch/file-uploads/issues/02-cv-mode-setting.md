# 02: Recruiter sets a job form's CV mode (off, optional, required)

**What to build:** A recruiter can choose whether a job's form asks for a **CV**: off, optional or required. The setting lives on the form version, so changing it after publishing creates a new version like any other edit. Existing published versions default to off and new drafts for a new job start at optional. The form builder shows a "CV" card above the questions with a three-way toggle and a note that CVs are PDF or DOCX up to 5 MB; interviewers see it read-only. The public job payload exposes the mode. Applicants see no change yet. See ADR-0002 and the spec's Implementation Decisions (Domain model, Persistence).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The contract gains the `files` table as planned in the schema doc (with a declared duration column) and a CV mode column on form versions, as text with a CHECK; contract artifacts are re-emitted and the dev database updated.
- [x] `docs/db-schema.md` matches the contract.
- [x] The shared form schemas carry the CV mode; tests cover valid and invalid values.
- [x] Saving a draft and publishing persist the mode; editing after publish creates a new draft version that keeps it.
- [x] The builder shows the CV card with a three-way toggle group; interviewers see it read-only; the unsaved-changes backup still works.
- [x] The public job payload includes the CV mode.
- [x] Existing published forms read back as off.

## Comments

Resolved on integration branch `feat/file-uploads`: merge af23fc3 (feat acc2f47).

Verified at repository level against the dev DB (create, update, publish, new draft after publish; all 10 existing form versions read back `off`). **Not yet verified in a browser on the live stack:** the CV card and toggle, interviewer read-only, the unsaved-changes backup. Review fix 0a8a43e added service tests for persistence across publish.

Live-stack verification (2026-10-16, https://localhost:3000, owner then interviewer test accounts): new job's CV card shows Optional by default with the PDF/DOCX 5 MB note; toggling to Required shows "Unsaved changes"; save and publish persist `cvMode` (DB row `required`, public payload `cvMode: "required"`); a restore banner appeared for an unsaved backup and Discard cleared it; as an interviewer the builder is read-only (no Save/Publish/Add question) and clicking the toggle changes nothing. Observed, pre-existing on main: a brand-new form can't be Saved or Published until something is edited, so the default Optional isn't persisted until then.
