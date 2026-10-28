import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageTitle } from '@/components/dashboard/company-page';
import { SkeletonGroup } from '@/components/dashboard/skeletons';
import { SettingsView } from '@/components/settings/settings-view';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getCurrentUser } from '@/lib/dal';

export const metadata: Metadata = { title: 'Settings · Farraza' };

/**
 * Per-user settings (not company-scoped), under the dashboard sidebar layout.
 * This fixed segment wins over /dashboard/[companySlug], so "settings" is a
 * reserved company slug (RESERVED_COMPANY_SLUGS in @repo/shared); otherwise a
 * company named "Settings" would have an unreachable dashboard.
 */
export default function SettingsPage() {
  return (
    <>
      <PageTitle title="Settings" description="Manage your account and how Farraza looks." />
      <SettingsView
        account={
          <Suspense fallback={<AccountSkeleton />}>
            <AccountCard />
          </Suspense>
        }
      />
    </>
  );
}

/** The Account card's shape: title and description, then Name and Email rows. */
function AccountSkeleton() {
  return (
    <SkeletonGroup label="Loading account" className="max-w-xl">
      <Card ghost aria-hidden="true">
        <CardHeader className="gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3.5 w-48" />
        </CardHeader>
        <CardContent className="grid gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="grid gap-1.5">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-44" />
            </div>
          ))}
        </CardContent>
      </Card>
    </SkeletonGroup>
  );
}

/**
 * Server-rendered slot for the Account tab. getCurrentUser() uses the private
 * cache and redirects on 401, so it must render inside <Suspense> (web.md, the DAL).
 */
async function AccountCard() {
  const user = await getCurrentUser();
  return (
    <Card ghost>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>The details you signed up with.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <div className="grid gap-1">
          <span className="text-muted-foreground">Name</span>
          <span className="font-medium">{user.name}</span>
        </div>
        <div className="grid gap-1">
          <span className="text-muted-foreground">Email</span>
          <span className="font-medium">{user.email}</span>
        </div>
      </CardContent>
    </Card>
  );
}
