'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { title: 'Overview', path: '' },
  { title: 'Application form', path: '/form' },
  { title: 'Candidates', path: '/candidates' },
] as const;

/**
 * The job's sections as links styled like tabs: each section is its own page
 * with its own URL, so they are navigation (aria-current), not shadcn Tabs
 * (which switch panels within one page).
 * useParams() suspends for dynamic segments under Cache Components, hence the
 * <Suspense> (03-api-reference/04-functions/use-params.md).
 */
export function JobTabs() {
  return (
    <Suspense fallback={<TabList />}>
      <JobTabLinks />
    </Suspense>
  );
}

function JobTabLinks() {
  const { companySlug, jobSlug } = useParams<{ companySlug: string; jobSlug: string }>();
  const pathname = usePathname();
  const base = `/dashboard/${companySlug}/jobs/${jobSlug}`;
  return <TabList base={base} pathname={pathname} />;
}

/** Without `base` (the static shell), the tabs show but aren't links yet. */
function TabList({ base, pathname }: { base?: string; pathname?: string }) {
  return (
    <nav aria-label="Job sections" className="flex gap-1 border-b">
      {TABS.map((tab) => {
        const href = base ? base + tab.path : undefined;
        const current = href !== undefined && pathname === href;
        const className = cn(
          '-mb-px inline-flex h-9 items-center border-b-2 px-3 text-sm font-medium transition-colors',
          current
            ? 'border-primary text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground',
        );
        return href ? (
          <Link key={tab.title} href={href} aria-current={current ? 'page' : undefined} className={className}>
            {tab.title}
          </Link>
        ) : (
          <span key={tab.title} className={className}>
            {tab.title}
          </span>
        );
      })}
    </nav>
  );
}
