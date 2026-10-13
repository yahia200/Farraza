'use client';

import { Suspense } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { NAV_ITEMS } from './nav-items';

/**
 * Header from shadcn block sidebar-07: sidebar toggle plus the current page's
 * name. Only the name reads the URL, so only it waits behind <Suspense>.
 */
export function DashboardHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <Suspense fallback={<BreadcrumbPage>Dashboard</BreadcrumbPage>}>
                <PageName />
              </Suspense>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}

/** Pages outside /dashboard/[companySlug] that still use this layout. */
const OTHER_PAGES: Record<string, string> = { '/companies/new': 'Add company' };

function PageName() {
  const { companySlug } = useParams<{ companySlug?: string }>();
  const pathname = usePathname();
  if (OTHER_PAGES[pathname]) {
    return <BreadcrumbPage>{OTHER_PAGES[pathname]}</BreadcrumbPage>;
  }
  const base = `/dashboard/${companySlug}`;
  const page = [...NAV_ITEMS]
    .reverse()
    .find((item) => pathname === base + item.path || (item.path && pathname.startsWith(base + item.path)));
  return <BreadcrumbPage>{page?.title ?? 'Dashboard'}</BreadcrumbPage>;
}
