import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signOut } from '@/app/actions/auth';
import { OnboardingChoice } from '@/components/onboarding/onboarding-choice';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';


import { getCurrentUser, getMyCompanies } from '@/lib/dal';
import { AuthCard } from '@/components/auth/auth-card';

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
    <AuthCard
      title={`Welcome, ${user.name.split(' ')[0]}!`}
      description="One quick step before you start hiring."
      footer={
        <div className='flex'>
          Not {user.name}?{' '}
          <form action={signOut}>
            <Button type="submit" variant="link" size="sm" className="px-0 font-normal ml-0.5 h-auto">
              Sign out
            </Button>
          </form>
        </div>
      }
    >
      <OnboardingChoice email={user.email} />
    </AuthCard>
  );
}
