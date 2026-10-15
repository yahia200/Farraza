# 02: Notes and activity timeline in the detail sheet

**What to build:** From the candidate detail sheet, a member can read an Application's full history and add a note. Opening a candidate shows an activity timeline — applied, auto-rejected, each stage move, hired/rejected, and notes, in order — and a composer to add a note that appears in the timeline right after posting. Notes are append-only and show their author and time. Works in the existing table + sheet; no board required.

**Blocked by:** 01 (`buildActivityTimeline`).

**Status:** ready-for-agent

- [ ] `getApplication` in the web DAL returns the Application's `events` and `notes` (it currently drops them, keeping only the auto-reject hint).
- [ ] An `addApplicationNote(companySlug, jobSlug, applicationId, body)` Server Action calls the API, validates the body with the shared `createNoteSchema`, and `revalidatePath`s the candidates route; API errors surface via `failureFromResponse`.
- [ ] The detail sheet renders an Activity section built with `buildActivityTimeline(events, notes)`: chronological, note entries show body + author + time, stage-change entries show what and when (not who).
- [ ] The detail sheet has a note composer; a posted note appears in the timeline without a full-page reload feeling broken.
- [ ] Every role (including interviewer) can add a note.
- [ ] Verified in the browser preview: open a candidate, see history, add a note, see it appear.
