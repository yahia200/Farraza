import { Suspense, type ReactNode } from 'react';
import { FormSkeleton, SkeletonGroup } from '@/components/dashboard/skeletons';
import { getCompany, getJob, type CompanyJob, type JobStage, type MyCompany } from '@/lib/dal';

type JobParams = Promise<{ companySlug: string; jobSlug: string }>;
export type LoadedJob = CompanyJob & { stages: JobStage[] };

/**
 * Like CompanyPage, for /dashboard/[companySlug]/jobs/[jobSlug]/…: awaits the
 * params inside <Suspense> (01-getting-started/08-caching.md) and loads the
 * company (membership check) and the job. Either missing gives the 404 page.
 * Both reads are 'use cache: private', so the layout and page share them.
 */
export function JobPage({
  params,
  children,
  fallback = (
    <SkeletonGroup label="Loading job">
      <FormSkeleton />
    </SkeletonGroup>
  ),
}: {
  params: JobParams;
  children: (company: MyCompany, job: LoadedJob) => ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <WithJob params={params}>{children}</WithJob>
    </Suspense>
  );
}

async function WithJob({
  params,
  children,
}: {
  params: JobParams;
  children: (company: MyCompany, job: LoadedJob) => ReactNode;
}) {
  const { companySlug, jobSlug } = await params;
  const [company, job] = await Promise.all([getCompany(companySlug), getJob(companySlug, jobSlug)]);
  return children(company, job);
}
