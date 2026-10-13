import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signOut } from '@/app/actions/auth';
import { getCurrentUser, getMyCompanies } from '@/lib/dal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

export const metadata: Metadata = { title: 'Dashboard · Khatwateen' };

/**
 * Protected placeholder. The page shell is static; only <Welcome> reads the
 * session, so it streams in behind <Suspense> (required with cacheComponents).
 * node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md (Step 2)
 */
export default function DashboardPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl items-center px-4 pt-20 pb-8">
      <Suspense fallback={<Spinner className="mx-auto size-6" />}>
        <Welcome />
      </Suspense>
    </main>
  );
}

async function Welcome() {
  const [user, companies] = await Promise.all([getCurrentUser(), getMyCompanies()]);
  // No company yet: finish onboarding first.
  if (companies.length === 0) {
    redirect('/onboarding');
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Welcome, {user.name}</CardTitle>
        <CardDescription>Signed in as {user.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="text-sm">
          {companies.map((company) => (
            <li key={company.id}>
              {company.name} <span className="text-muted-foreground">· {company.role}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        {/* A Server Action as a form action: works without client JS. */}
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
