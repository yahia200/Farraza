import { Suspense } from 'react';
import { AccountSkeleton, AppSidebar } from '@/components/dashboard/app-sidebar';
import { CompanySwitcher } from '@/components/dashboard/company-switcher';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { NavUser } from '@/components/dashboard/nav-user';
import { PersistentSidebarProvider } from '@/components/dashboard/persistent-sidebar';
import { VerifyEmailReminder } from '@/components/dashboard/verify-email-reminder';
import { SidebarInset } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getCurrentUser, getMyCompanies } from '@/lib/dal';

/**
 * Every /dashboard page: the shadcn sidebar (floating variant) around the page.
 * Its open/collapsed state is restored from the sidebar_state cookie
 * (components/dashboard/persistent-sidebar.tsx).
 *
 * The layout itself reads no session or params, so the frame is in the static
 * shell (authentication-with-cache-components.md, Step 2). The two parts that
 * need account data are async Server Components passed into the client
 * sidebar as props, each behind its own <Suspense> ("Interleaving Server and
 * Client Components" in 01-getting-started/05-server-and-client-components.md).
 *
 * TooltipProvider and Toaster are here, not in the root layout, because only
 * the dashboard uses tooltips and toasts so far. Toaster renders the toasts
 * added anywhere with `toast.add()` (components/ui/toast.tsx).
 */
export default function DashboardLayout({ children }: LayoutProps<'/'>) {
  return (
    <TooltipProvider>
      <PersistentSidebarProvider>
        <AppSidebar
          header={
            <Suspense fallback={<AccountSkeleton />}>
              <CompanySwitcherSlot />
            </Suspense>
          }
          footer={
            <Suspense fallback={<AccountSkeleton />}>
              <NavUserSlot />
            </Suspense>
          }
        />
        {/* `min-w-0`: SidebarInset is a flex item beside the sidebar, and a flex item can't shrink below
            its content's width unless this is set, so a wide table would stretch the whole page. */}
        <SidebarInset className="min-w-0">
          <DashboardHeader />
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {/* Reads the session, so it streams in after the static shell. */}
            <Suspense fallback={null}>
              <VerifyEmailReminderSlot />
            </Suspense>
            {children}
          </div>
        </SidebarInset>
      </PersistentSidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}

async function CompanySwitcherSlot() {
  return <CompanySwitcher companies={await getMyCompanies()} />;
}

async function NavUserSlot() {
  return <NavUser user={await getCurrentUser()} />;
}

/** Nothing for a verified user. getCurrentUser() is cached, so this costs no extra request. */
async function VerifyEmailReminderSlot() {
  const user = await getCurrentUser();
  return user.emailVerified ? null : <VerifyEmailReminder email={user.email} />;
}
