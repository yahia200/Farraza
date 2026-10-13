import { BriefcaseIcon, LayoutDashboardIcon, SettingsIcon, UsersIcon } from 'lucide-react';

/**
 * The company's pages, relative to /dashboard/[companySlug].
 * Kept out of the 'use client' nav files: a Server Component that imports a
 * non-component value from a client module gets a client reference, not the
 * value (01-getting-started/05-server-and-client-components.md).
 */
export const NAV_ITEMS = [
  { title: 'Overview', path: '', icon: LayoutDashboardIcon },
  { title: 'Jobs', path: '/jobs', icon: BriefcaseIcon },
  { title: 'Members', path: '/members', icon: UsersIcon },
  { title: 'Settings', path: '/settings', icon: SettingsIcon },
] as const;
