# 03: Move a candidate from the detail sheet

**What to build:** From the candidate detail sheet, a member who can manage the pipeline can move an Application to another Stage with a "Move to stage" control. The move persists, the Application's outcome updates (moving into a hired or rejected Stage sets the status), and the history records it. Interviewers don't see the control. If the candidate was already moved by someone else, the user gets a toast and a refresh rather than a silent failure. This delivers the core move capability before any board exists.

**Blocked by:** 01 (`canMoveApplications`, `statusForStageKind`).

**Status:** ready-for-agent

- [ ] A `moveApplication(companySlug, jobSlug, applicationId, stageId)` Server Action calls the API move endpoint and `revalidatePath`s the candidates route.
- [ ] The API's `409` (stale move / already in that stage) is mapped through `failureFromResponse` to a toast + refresh, not a form-field error.
- [ ] The detail sheet shows a "Move to stage" `Select` (Base UI) listing the Job's Stages; choosing one moves the candidate and the sheet reflects the new Stage and status.
- [ ] The control is hidden when `canMoveApplications(role)` is false (interviewers).
- [ ] Verified in the browser preview: move a candidate between stages as a recruiter; confirm a hired/rejected stage updates the status; confirm an interviewer sees no control.
