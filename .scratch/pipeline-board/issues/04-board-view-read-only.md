# 04: Board view (read-only)

**What to build:** A board view of a Job's pipeline, toggled from the Candidates page. On desktop it shows one column per Stage with the Applications in each; on mobile it shows the Stages as tabs (defaulting to the first Stage) to avoid a wide horizontal scroll. Each Stage shows a count, empty Stages show a placeholder, and a Job with no Applications shows a single clear message. Clicking a card opens the existing candidate detail sheet. Read-only here — moving comes in ticket 05.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A board-shaped DAL loader returns the Stage columns with their Applications (the current `getApplications` flattens them for the table; the board needs the columns). The table and board may share one fetch of the board endpoint.
- [ ] A `?view=table|board` search param (default `table`) switches the view, server-rendered, and composes with the existing `?application=<id>` sheet param.
- [ ] Desktop renders Stage columns; mobile renders Stage tabs (shadcn Tabs) defaulting to the first Stage; both show per-Stage count badges and the same count in desktop column headers.
- [ ] Empty Stage shows a muted placeholder; a Job with zero Applications shows a single empty message.
- [ ] Clicking a card opens the same detail sheet (`?application=<id>`) the table uses; desktop and mobile render the same card component.
- [ ] Verified in the browser preview at desktop and mobile widths: toggle to board, see columns/tabs with counts and empty states, click a card to open the sheet.
