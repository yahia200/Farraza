import { Suspense, type ReactNode } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { getCompany, type MyCompany } from '@/lib/dal';

/**
 * Frame for every /dashboard/[companySlug] page. The params promise is
 * awaited inside <Suspense> rather than at the top of the page, so the rest
 * of the route stays in the static shell (01-getting-started/08-caching.md).
 * getCompany() is also the membership check: non-members get the 404 page.
 */
export function CompanyPage({
  params,
  children,
}: {
  params: Promise<{ companySlug: string }>;
  children: (company: MyCompany) => ReactNode;
}) {
  return (
    <Suspense fallback={<Spinner className="m-auto size-6" />}>
      <WithCompany params={params}>{children}</WithCompany>
    </Suspense>
  );
}

async function WithCompany({
  params,
  children,
}: {
  params: Promise<{ companySlug: string }>;
  children: (company: MyCompany) => ReactNode;
}) {
  const { companySlug } = await params;
  return children(await getCompany(companySlug));
}

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-1">
      <h1 className="font-heading text-xl font-semibold">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
