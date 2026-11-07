# 08: Re-check button and progress

**What to build:** The Re-check control on the Requirements section. Spec: `.scratch/keyword-match/spec.md` ("Web").

- Idle: "Re-check N", where N comes from the count route, disabled when N is zero.
- Running: "Re-checking… processed / total", polled from the status route; clicking does nothing while a run is active.
- Finished: the count refreshes and the control returns to idle; new markers appear on the next load of the list and board.
- Polling stops when the run ends or the page is left.

**Blocked by:** 06, 07.

**Status:** resolved

- [x] The button is disabled at zero and during a run
- [x] Progress advances without a page reload and polling stops when the run ends
- [x] An error from the status route shows a message and stops polling rather than looping
- [x] `pnpm lint`, `pnpm check-types` and both test suites pass
