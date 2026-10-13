'use client';

import type { ReactNode } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { NavMain } from './nav-main';
import { SIDEBAR_COLLAPSIBLE, SidebarStateScript } from './persistent-sidebar';

/**
 * Adapted from shadcn block sidebar-07 (`collapsible="icon"`) with the `floating`
 * variant: https://ui.shadcn.com/docs/components/base/sidebar
 *
 * The frame must not sit inside a <Suspense> boundary: on a phone the provider
 * switches to the mobile sheet right after hydrating, and a boundary that
 * hydrates later would no longer match the desktop HTML from the server.
 * Only the data parts wait, passed in as `header` and `footer` (Server
 * Components inside their own boundaries; see the dashboard layout).
 */
export function AppSidebar({ header, footer }: { header: ReactNode; footer: ReactNode }) {
  return (
    <>
      <Sidebar variant="floating" collapsible={SIDEBAR_COLLAPSIBLE}>
        <SidebarHeader>{header}</SidebarHeader>
        <SidebarContent>
          <NavMain />
        </SidebarContent>
        <SidebarFooter>{footer}</SidebarFooter>
        <SidebarRail />
      </Sidebar>
      {/* After the sidebar in the HTML, so the element exists when it runs. */}
      <SidebarStateScript />
    </>
  );
}

/**
 * Placeholder for the company switcher and user menu while their data loads.
 * Not shadcn's SidebarMenuSkeleton: that picks a random width with
 * Math.random(), which Cache Components rejects in the prerendered shell
 * (https://nextjs.org/docs/messages/blocking-prerender-random-client).
 */
export function AccountSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex h-12 items-center gap-2 px-2">
        <Skeleton className="size-8 shrink-0 rounded-lg" />
        <div className="grid flex-1 gap-1.5 group-data-[collapsible=icon]:hidden">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
