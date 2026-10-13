'use client';

import { useState, type ReactNode } from 'react';
import { InlineScript } from '@/components/inline-script';
import { SidebarProvider } from '@/components/ui/sidebar';

/*
 * Remembering whether the sidebar is open, without reading the cookie on the
 * server. Reading cookies() in the layout would push the sidebar behind
 * <Suspense> (Cache Components), which breaks hydration on phones (see
 * AppSidebar). Instead, following "Storing the theme in a cookie" and
 * "Syncing with React state" in
 * node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md:
 *   1. SidebarStateScript fixes the DOM before first paint on a full page load;
 *   2. the lazy useState below reads the same cookie on the client, so React's
 *      first render matches that DOM and hydration succeeds.
 * Writing the cookie is already done by shadcn's SidebarProvider on every
 * toggle (components/ui/sidebar.tsx, setOpen), in controlled mode too.
 */

/** Must match SIDEBAR_COOKIE_NAME in components/ui/sidebar.tsx (not exported there). */
const COOKIE_NAME = 'sidebar_state';
/** The `collapsible` prop on <Sidebar> in AppSidebar (shadcn's three options). */
export const SIDEBAR_COLLAPSIBLE: 'offcanvas' | 'icon' | 'none' = 'icon';

/** The saved state: open unless the cookie says "false" (first visit: open). */
function readSavedOpen(): boolean {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match?.[1] !== 'false';
}

/** shadcn's SidebarProvider in controlled mode, starting from the saved state. */
export function PersistentSidebarProvider({ children }: { children: ReactNode }) {
  // The initializer runs once: on the server (no document) it returns the
  // default, in the browser it reads the cookie.
  const [open, setOpen] = useState(() => (typeof document === 'undefined' ? true : readSavedOpen()));
  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      {children}
    </SidebarProvider>
  );
}

/**
 * Render right after <Sidebar>. When the saved state is collapsed, sets the
 * two attributes that state controls (data-state, data-collapsible on
 * [data-slot=sidebar]) so the first paint is already collapsed.
 */
export function SidebarStateScript() {
  // collapsible="none" renders a plain sidebar without state attributes: nothing to restore.
  if (SIDEBAR_COLLAPSIBLE === 'none') {
    return null;
  }
  return (
    <InlineScript
      html={`(function(){try{var m=document.cookie.match(/(?:^|; )${COOKIE_NAME}=([^;]*)/);if(m&&m[1]==="false"){var s=document.querySelector('[data-slot="sidebar"]');if(s){s.setAttribute("data-state","collapsed");s.setAttribute("data-collapsible","${SIDEBAR_COLLAPSIBLE}")}}}catch(e){}})()`}
    />
  );
}
