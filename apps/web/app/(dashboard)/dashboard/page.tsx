import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getMyCompanies } from '@/lib/dal';

/** /dashboard has no page of its own: it sends you to your first company, or to onboarding. */
export default function DashboardIndexPage() {
  return (
    // Nothing to draw: this page only redirects (web.md, "Loading states").
    <Suspense fallback={null}>
      <ToFirstCompany />
    </Suspense>
  );
}

async function ToFirstCompany(): Promise<null> {
  const [first] = await getMyCompanies();
  redirect(first ? `/dashboard/${first.slug}` : '/onboarding');
}
