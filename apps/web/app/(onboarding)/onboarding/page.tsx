import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signOut } from '@/app/actions/auth';
import { OnboardingChoice } from '@/components/onboarding/onboarding-choice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { getCurrentUser, getMyCompanies } from '@/lib/dal';

export const metadata: Metadata = { title: 'Get started · Farraza' };

/** Shown until the user belongs to a company. The session read streams in behind <Suspense>. */
export default function OnboardingPage() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <Suspense fallback={<Spinner className="mx-auto size-6" />}>
          <Onboarding />
        </Suspense>
      </div>
    </main>
  );
}

async function Onboarding() {
  const [user, companies] = await Promise.all([getCurrentUser(), getMyCompanies()]);
  if (companies.length > 0) {
    redirect('/dashboard');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome, {user.name}</CardTitle>
        <CardDescription>One quick step before you start hiring.</CardDescription>
      </CardHeader>
      <CardContent>
        <OnboardingChoice email={user.email} />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Not {user.name}?
        <form action={signOut}>
          <Button type="submit" variant="link" size="sm">
            Sign out
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
