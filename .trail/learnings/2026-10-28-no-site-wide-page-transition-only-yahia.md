---
title: "No site-wide page transition: only apps/web/components/dashboard/jobs/job-page-transition.tsx for job tab pages"
author: Yahia
date: 2026-10-28
branch: feat/ratings
cost: { minutes: 16, tokens: 122760 }
id: l-0c2aa190
scope: repo
status: active
src: agent
touches:
  - apps/web/components/ui/popover.tsx
  - apps/web/components/dashboard/jobs/job-page-transition.tsx
  - apps/web/components/dashboard/company-page.tsx
---

## Decided
- Only the job Overview, Application form and Candidates pages fade (apps/web/components/dashboard/jobs/job-page-transition.tsx, React ViewTransition in each page.tsx). No transition on other dashboard pages.

## Tried and ruled out
- Animate UI's PageTransition (registry item components-page-transition, effect="random") in apps/web/app/(dashboard)/layout.tsx: it adds 0.3 to 0.7 s to every navigation, can't be interrupted, and keys on usePathname(), which suspends on dynamic routes and forced a Suspense boundary that dropped page content from the static shell. Removed.
- A ViewTransition inside each CompanyPage/JobPage Suspense (apps/web/components/dashboard/company-page.tsx): worked in Chrome on cached and uncached pages when measured, so the "enter only on uncached pages" report could not be reproduced.

## Watch out
- A layout-level ViewTransition never fires on navigation within it; wrap in page.tsx (02-guides/view-transitions.md, Step 3).
- Browser back/forward does not animate view transitions in Next.
