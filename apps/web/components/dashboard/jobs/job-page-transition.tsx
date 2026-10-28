import { ViewTransition } from 'react';

/**
 * Gives a job section (Overview, Application form, Candidates) the tab panels'
 * enter/exit fade. It goes in each page.tsx, not the layout: a layout persists
 * across navigations, so enter and exit would never fire there
 * (02-guides/view-transitions.md, Step 3). The animation itself is the
 * `job-page-in` / `job-page-out` CSS in globals.css; `default="none"` keeps
 * this from animating on unrelated transitions, and since the wrapper stays
 * mounted when only ?view= or ?application= changes, those don't animate.
 */
export function JobPageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="job-page-in" exit="job-page-out" default="none">
      {children}
    </ViewTransition>
  );
}
