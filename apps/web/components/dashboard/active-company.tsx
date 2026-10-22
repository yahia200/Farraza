'use client';

import { createContext, use, useMemo, useState, type ReactNode } from 'react';

type ActiveCompany = {
  /**
   * The company the sidebar is showing: `undefined` until the company switcher
   * has its data, `null` when the user has no company.
   */
  slug: string | null | undefined;
  setSlug: (slug: string | null) => void;
};

const ActiveCompanyContext = createContext<ActiveCompany | null>(null);

/**
 * Remembers the sidebar's company across pages that have no [companySlug],
 * like /dashboard/settings. It lives in AppSidebar, which the (dashboard)
 * layout keeps mounted, so the value survives client navigation; a full page
 * load starts from `undefined` again.
 *
 * The provider can't read the slug itself: useParams() suspends under Cache
 * Components, and the sidebar frame must stay outside <Suspense>. So the
 * CompanySwitcher, which has the company list, resolves the company and
 * reports it here, and NavMain follows it.
 * React 19 context as a provider: https://react.dev/reference/react/createContext#provider
 */
export function ActiveCompanyProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState<string | null | undefined>(undefined);
  const value = useMemo(() => ({ slug, setSlug }), [slug]);
  return <ActiveCompanyContext value={value}>{children}</ActiveCompanyContext>;
}

export function useActiveCompany(): ActiveCompany {
  const context = use(ActiveCompanyContext);
  if (!context) {
    throw new Error('useActiveCompany must be used within an ActiveCompanyProvider.');
  }
  return context;
}
