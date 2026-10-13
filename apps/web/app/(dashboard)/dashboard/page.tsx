import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { getMyCompanies } from '@/lib/dal';

/** /dashboard has no page of its own: it sends you to your first company, or to onboarding. */
export default function DashboardIndexPage() {
  return (
    <Suspense fallback={<Spinner className="m-auto size-6" />}>
      <ToFirstCompany />
    </Suspense>
  );
}

async function ToFirstCompany(): Promise<null> {
  const [first] = await getMyCompanies();
  redirect(first ? `/dashboard/${first.slug}` : '/onboarding');
}
