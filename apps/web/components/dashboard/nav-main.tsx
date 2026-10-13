'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { NAV_ITEMS } from './nav-items';


/**
 * Adapted from shadcn block sidebar-07 (nav-main), without collapsible
 * submenus. Links use Base UI's `render` prop, not `asChild`:
 * https://ui.shadcn.com/docs/components/base/sidebar
 *
 * useParams() suspends for [companySlug] under Cache Components, so the links
 * render behind <Suspense>; the fallback is the same items, not yet links
 * (03-api-reference/04-functions/use-params.md, "Cache Components").
 */
export function NavMain() {
  return (
    <Suspense fallback={<NavItems />}>
      <NavLinks />
    </Suspense>
  );
}

/** The menu without links: shown in the static shell until the URL is known. */
function NavItems() {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {NAV_ITEMS.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton tooltip={item.title}>
              <item.icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function NavLinks() {
  // The slug comes from the URL on the client, so the layout never awaits params.
  const { companySlug } = useParams<{ companySlug?: string }>();
  const pathname = usePathname();
  if (!companySlug) {
    return null;
  }

  const base = `/dashboard/${companySlug}`;
  return (
    <SidebarGroup>
      <SidebarMenu>
        {NAV_ITEMS.map((item) => {
          const href = base + item.path;
          // Overview matches only itself; the others also match their sub-pages.
          const isActive = item.path === '' ? pathname === href : pathname.startsWith(href);
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton render={<Link href={href} />} isActive={isActive} tooltip={item.title}>
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
