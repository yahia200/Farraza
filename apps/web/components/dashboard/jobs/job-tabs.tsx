'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TABS = [
  { title: 'Overview', path: '' },
  { title: 'Application form', path: '/form' },
  { title: 'Candidates', path: '/candidates' },
] as const;

/**
 * The job's sections as shadcn Tabs whose triggers are links (Base UI
 * docs/react/components/tabs.md, "Rendering as links"): each section is its own
 * page with its own URL, so `value` follows the pathname and there are no panels.
 * useParams() suspends for dynamic segments under Cache Components, hence the
 * <Suspense> (03-api-reference/04-functions/use-params.md).
 *
 * The links use `prefetch` (= true): with partialPrefetching on, the default only
 * loads each route's App Shell, and these pages depend on URL data (the params),
 * so true also resolves their 'use cache: private' reads before the click
 * (02-guides/optimizing-prefetching.md, "Resolve URL data at prefetch time";
 * 03-api-reference/02-components/link.md, "prefetch"). Production only.
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
  const current = base === undefined ? null : (TABS.find((tab) => pathname === base + tab.path)?.title ?? null);
  return (
    <Tabs value={current} aria-label="Job sections" className="w-full">
      <TabsList variant="line" className="w-full border-b px-0 *:-mb-1">
        {TABS.map((tab) => (
          <TabsTrigger
            key={tab.title}
            value={tab.title}
            {...(base !== undefined && {
              nativeButton: false,
              render: <Link href={base + tab.path} prefetch />,
            })}
          >
            {tab.title}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
