Status: ready-for-agent

# Complete the candidate pipeline feature (web)

## Problem Statement

A company's members can see everyone who applied to a Job, but the Candidates page is read-only. There is no way to move an Application through the Job's pipeline, leave a note on it, or see its history — even though the API already supports all of this. Members can't actually run their hiring pipeline from the app.

## Solution

Complete the web UI on top of the finished pipeline API so members can work a Job's pipeline end to end:

- Switch the Candidates page between the existing **table** and a new **board** (stage columns on desktop, stage tabs on mobile).
- **Move** an Application to another Stage by dragging a card (desktop pointer) or picking a stage from a control (everywhere), with the change showing immediately and rolling back if the server rejects it.
- Read and add **notes** on an Application, and see its full **activity timeline**, in the detail sheet.
- Interviewers see everything read-only except notes, matching what the API already enforces.

## User Stories

1. As a recruiter, I want to switch the Candidates page between a table and a board, so that I can scan a long list or see the pipeline shape as suits the task.
2. As a recruiter, I want the board to show one column per Stage with the Applications in each, so that I can see where every candidate sits at a glance.
3. As a recruiter, I want each board column and the table to show how many Applications are in each Stage, so that I can gauge pipeline load.
4. As a recruiter, I want to drag an Application card from one Stage column to another on desktop, so that I can advance a candidate quickly.
5. As a recruiter, I want the card to move to the new column instantly when I drop it, so that the board feels responsive.
6. As a recruiter, I want a dropped card to snap back with a message if the move failed (for example, someone else already moved the candidate), so that the board never lies about where a candidate is.
7. As a recruiter, I want dropping a card back in its own column to do nothing, so that I don't create empty history entries by accident.
8. As a recruiter on a phone, I want the board shown as stage tabs rather than a wide scrolling row, so that I can review one Stage at a time without horizontal scrolling.
9. As a recruiter on a phone or using a keyboard, I want a "Move to stage" control on each card and in the detail sheet, so that I can move a candidate without dragging.
10. As a recruiter, I want moving a candidate into a Stage of kind hired or rejected to update the Application's outcome automatically, so that status always reflects the Stage.
11. As a member, I want clicking a card or table row to open the same candidate detail sheet, so that moving between the two views is seamless.
12. As a member, I want the detail sheet to show the candidate's contact details and their answers to the form version they applied with, so that I can evaluate them.
13. As a member, I want to see an activity timeline of everything that happened to an Application — applied, auto-rejected, each stage move, hired/rejected, and notes — in order, so that I understand its history.
14. As a member, I want to add a note to an Application, so that I can record my thoughts for the team.
15. As a member, I want a new note to appear in the timeline immediately after I add it, so that I can see it landed.
16. As a member, I want notes to be append-only (no edit or delete), so that the record is trustworthy.
17. As a member, I want to see each note's author and when it was written, so that I know who said what.
18. As an interviewer, I want to view the board, table, detail, and timeline, so that I can evaluate candidates.
19. As an interviewer, I want to add notes, so that I can record interview feedback.
20. As an interviewer, I want the move controls hidden and dragging disabled, so that I'm not offered an action the server would reject.
21. As a member, I want an empty Stage to show a clear placeholder, so that an empty column doesn't look broken.
22. As a member, I want a Job with no Applications to show a single clear message, so that an empty pipeline is obvious.
23. As a member, I want the chosen view and the open candidate to live in the URL, so that I can link someone straight to a board with a candidate open.

## Implementation Decisions

- **Backend is unchanged.** The pipeline API (`GET` board, `GET` detail with events + notes, `POST` move, `POST` notes) and `ApplicationPolicy` are complete. This spec is web-only, plus shared pure logic.
- **Shared pure logic (`@repo/shared`), the single test seam:**
  - `canMoveApplications(role)` added to `members.ts`, mirroring `ApplicationPolicy` (everyone except `interviewer`). Note-adding is allowed for all roles.
  - A new `pipeline.ts` module with pure functions:
    - `statusForStageKind(kind)` → `active | hired | rejected` from `normal | hired | rejected`.
    - `applyMove(columns, applicationId, toStageId)` → new columns with the card moved and its status recomputed; a no-op when the card is already in `toStageId`. This is the optimistic reducer.
    - `buildActivityTimeline(events, notes)` → one chronologically ordered list, resolving each `note_added` event to its note body (events carry only `{ noteId }`).
  - The API may later adopt `statusForStageKind` in place of its private `STATUS_FOR_STAGE`; not required by this spec.
- **DAL (`apps/web/lib/dal.ts`):**
  - Add a board-shaped loader that preserves the Stage columns (the current `getApplications` flattens them for the table; the board needs the columns). Both views may share one fetch of the board endpoint.
  - `getApplication` must return the Application's `events` and `notes` (it currently drops them, keeping only the auto-reject hint).
- **Server Actions (`apps/web/app/actions/applications.ts`):**
  - `moveApplication(companySlug, jobSlug, applicationId, stageId)` and `addApplicationNote(companySlug, jobSlug, applicationId, body)`.
  - Each calls the API, then `revalidatePath` on the candidates route so the `'use cache: private'` DAL refetches.
  - Map the API's `409` (stale move / already-in-stage) through `failureFromResponse` to a toast + refresh, not a form field error. Note bodies are validated with the API's `createNoteSchema` from `@repo/shared`.
- **View toggle:** a `?view=table|board` search param (default `table`), server-rendered, composing with the existing `?application=<id>` sheet param.
- **Board UI:** desktop renders Stage columns; mobile renders Stage tabs (shadcn Tabs on Base UI) defaulting to the first Stage, both with count badges and empty-state placeholders. Desktop and mobile render the same card component and the same move control.
- **Move interaction:** a shared "Move to stage" control (Base UI `Select`) is the primary, accessible path on every card and in the detail sheet; `@atlaskit/pragmatic-drag-and-drop` layers drag over it on desktop pointer devices (see ADR-0001). Cross-Stage only; there is no intra-Stage ordering (no position field on Application).
- **Optimistic updates:** a client board component holds board state via React 19 `useOptimistic`, seeded from the server-loaded columns. A drop or a Select change applies `applyMove` optimistically and calls `moveApplication`; `useOptimistic` reverts automatically on error, and `revalidatePath` resyncs on success.
- **Detail sheet:** add a notes composer (append-only) and an activity timeline built with `buildActivityTimeline`, reused by both views. Stage-change events show what and when, not who (actor names aren't in the API).
- **Permissions in UI:** interviewers (`!canMoveApplications(role)`) get no move control and no drag; everyone may add notes. This mirrors the form builder's read-only pattern.
- **Library:** add `@atlaskit/pragmatic-drag-and-drop` to `apps/web`, chosen over `@dnd-kit/*` for maintenance and React-version independence (ADR-0001).

## Testing Decisions

- **What a good test is here:** exercise external behavior of the pure functions through their inputs and outputs — the resulting columns, timeline, or boolean — never internal structure. Table-driven cases covering the branches (same-column no-op, hired/rejected status recompute, note-body resolution, interviewer vs. others).
- **Modules tested (one seam, `packages/shared` + Vitest):**
  - `members.ts` — `canMoveApplications` across all four roles.
  - `pipeline.ts` — `statusForStageKind` for each kind; `applyMove` for cross-stage move, status recompute, and same-column no-op; `buildActivityTimeline` for ordering and note-body resolution (including a `note_added` whose note is missing).
- **Prior art:** `packages/shared/src/members.test.ts` (role logic), `answers.test.ts` and `form-fields.test.ts` (pure data-shaping over domain shapes). Match their style and file layout; run with `pnpm --filter @repo/shared test`.
- **Not automatically tested:** the board, drag wiring, mobile tabs, detail sheet, and Server Actions. `apps/web` has no test harness and standing one up is out of scope; verify these in the browser preview (board renders, optimistic move + rollback on 409, note add, timeline, interviewer read-only, empty states, mobile tabs).

## Out of Scope

- A withdraw flow. The Application status `withdrawn` exists in the schema but nothing sets it and there is no Stage of that kind; adding an employee "mark withdrawn" action is a separate feature (API + web).
- Actor names on activity events. Events carry `actorId` only, so stage-change entries show what and when, not who; surfacing names is an API change left for later.
- Intra-Stage ordering of cards (no position field on Application).
- Any API or schema change. Editing/deleting notes (API is append-only).
- A web test harness (RTL/Playwright) for the UI layer.

## Further Notes

- Keep the page's user-facing label "Candidates" even though each row is an Application (see `GLOSSARY.md`); code and types stay precise ("application").
- Follows ADR-0001 (pragmatic-drag-and-drop) and the project's working agreement: read installed-version docs for `useOptimistic`, Base UI Tabs/Select, and pragmatic-drag-and-drop before writing against them.
- The move endpoint is already optimistic-concurrency safe (conditional update, returns 409 when the card has moved), which is what makes client-side optimistic UI safe here.
