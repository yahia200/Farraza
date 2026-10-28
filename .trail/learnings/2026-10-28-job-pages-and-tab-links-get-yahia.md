---
title: "Job pages and tab links get the Tabs look via Base UI render=Link and a ViewTransition fade, not client-side panels"
author: Yahia
date: 2026-10-28
branch: feat/ratings
cost: { minutes: 10, tokens: 74447 }
id: l-c9711c0e
scope: repo
status: active
src: agent
touches:
  - apps/web/components/dashboard/candidates/candidates-view-toggle.tsx
  - apps/web/components/dashboard/jobs/job-tabs.tsx
  - apps/web/components/dashboard/jobs/form-builder/cv-card.tsx
  - "apps/web/app/(dashboard)/dashboard/[companySlug]/jobs/[jobSlug]/page.tsx"
  - "apps/web/app/(dashboard)/dashboard/[companySlug]/jobs/[jobSlug]/form/page.tsx"
  - "apps/web/app/(dashboard)/dashboard/[companySlug]/jobs/[jobSlug]/candidates/page.tsx"
  - apps/web/components/ui/tabs.tsx
  - apps/web/components/settings/appearance-mode.tsx
  - apps/web/next.config.ts
---

## Decided
- Link-based tabs (job-tabs.tsx, candidates-view-toggle.tsx) use the real shadcn Tabs with `nativeButton={false}` + `render={<Link />}` (Base UI tabs.md, "Rendering as links"), `value` controlled by pathname / `?view=`, no panels. That is the only way to get Animate UI's sliding indicator: its hook is internal and keyed on `data-animate-ui-tab` + `aria-selected`, so copying the classes does not animate.
- Page enter/exit between Overview, Application form and Candidates: React `<ViewTransition>` in each page.tsx via `components/dashboard/jobs/job-page-transition.tsx`, CSS `job-page-in/out` in globals.css (150ms out, 300ms in, 5px blur, from Animate UI panel tokens). Next 16.4.2 needs no config flag (view-transitions.md).

## Tried and ruled out
- Enter-only `template.tsx` with Motion: no exit animation, the old page is gone on route change.
- Real client-side Tabs panels for the three sections: identical animation but loses separate URLs and per-page server rendering.
- Importing `tabsListVariants` into a Server Component: it comes from a `'use client'` module, so you get a client reference, not the function.

## Watch out
- Put `<ViewTransition>` in page.tsx, never the layout; layouts persist, so enter/exit never fire.
- No slide yet: the tab panels also shift 12px by direction, which would need `transitionTypes` on the links.
