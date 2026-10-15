# 05: Drag + optimistic moves on the board

**What to build:** Make the board interactive. On a desktop pointer device, a member who can manage the pipeline drags a card from one Stage column to another and it moves instantly, snapping back with a toast if the server rejects the move (e.g. someone already moved the candidate). The same card also carries the "Move to stage" control for keyboard, touch, and the mobile tabs. Dropping a card back in its own column does nothing. Interviewers get neither drag nor control.

**Blocked by:** 01 (`applyMove`, `canMoveApplications`), 03 (`moveApplication` action + the move `Select`), 04 (the board view).

**Status:** ready-for-agent

- [ ] `@atlaskit/pragmatic-drag-and-drop` is added to `apps/web` (per ADR-0001).
- [ ] The board is a client component holding its columns via `useOptimistic`, seeded from the server-loaded board; a drop or a card `Select` change applies `applyMove` optimistically and calls `moveApplication`.
- [ ] On success the server state resyncs (`revalidatePath`); on error/`409` the optimistic move reverts and a toast fires.
- [ ] Drag is desktop-pointer only; a same-column drop is a no-op (no API call, no event). Cross-Stage only (no intra-Stage ordering).
- [ ] Each card carries the "Move to stage" `Select` from ticket 03 as the keyboard/touch/mobile-tabs path; both drag and control are hidden when `canMoveApplications(role)` is false.
- [ ] Verified in the browser preview: drag a card across columns (instant move), force a `409` to see the rollback + toast, move via the `Select` on mobile tabs, and confirm an interviewer can do neither.
