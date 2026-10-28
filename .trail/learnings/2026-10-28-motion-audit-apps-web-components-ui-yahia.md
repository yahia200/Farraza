---
title: "Motion audit: apps/web/components/ui/popover.tsx, button.tsx and sidebar.tsx are not on Animate UI yet"
author: Yahia
date: 2026-10-28
branch: feat/ratings
cost: { minutes: 1, tokens: 1745 }
id: l-09c1aed2
scope: repo
status: active
src: agent
touches:
  - apps/web/components/ui/popover.tsx
  - apps/web/components/date-picker.tsx
  - apps/web/components/ui/button.tsx
  - apps/web/components/ui/sidebar.tsx
---

## Decided
- The .claude/rules/web.md rule "Animate UI first, Animate UI-consistent otherwise" is a hard constraint. An audit of apps/web/components/ui (reading code only, not run in the browser) found the gaps below; none are fixed yet.

## Tried and ruled out
- Nothing dropped. Gaps: apps/web/components/ui/popover.tsx (plain Base UI although primitives/base-ui/popover exists; used by the pickers and apps/web/components/date-picker.tsx), apps/web/components/ui/button.tsx (CSS transition-all plus a 1px press nudge; Animate UI has primitives/buttons/button and ripple), apps/web/components/ui/sidebar.tsx (hand-built CSS; Animate UI has primitives/sidebar), and CSS-only input.tsx, textarea.tsx, card.tsx, table.tsx, calendar.tsx, attachment.tsx, breadcrumb.tsx, alert.tsx, skeleton.tsx and spinner.tsx (Tailwind animate-*).

## Watch out
- Fix order agreed: popover.tsx first (a primitive exists, three call sites), then button.tsx (touches everything).
- `shadcn add --overwrite` brings the plain Base UI imports back for converted components; re-run the Animate UI conversion (see .claude/rules/web.md).
