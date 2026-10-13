import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';
import { canManageJobs } from '@repo/shared';
import { JobPage } from '@/components/dashboard/jobs/job-page';
import { JobStatusActions } from '@/components/dashboard/jobs/job-status-actions';
import { JobStatusBadge } from '@/components/dashboard/jobs/job-status-badge';
import { JobTabs } from '@/components/dashboard/jobs/job-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { hasPublishedForm } from '@/lib/dal';

/**
 * Shared by a job's sections (Overview, Application form, Candidates).
 * Awaits nothing at the top: the header waits for params and data behind
 * <Suspense> (inside JobPage), the tabs and {children} stay in the static shell.
 */
export default function JobLayout({ children, params }: LayoutProps<'/dashboard/[companySlug]/jobs/[jobSlug]'>) {
  return (
    <div className="flex flex-col gap-4">
      <JobPage params={params} fallback={<Skeleton className="h-12 w-80" />}>
        {(company, job) => (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <Link
                href={`/dashboard/${company.slug}/jobs`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeftIcon className="size-3" />
                Jobs
              </Link>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-xl font-semibold">{job.title}</h1>
                <JobStatusBadge status={job.status} />
              </div>
            </div>
            {canManageJobs(company.role) && <JobStatusActionsSlot companySlug={company.slug} job={job} />}
          </div>
        )}
      </JobPage>
      <JobTabs />
      {children}
    </div>
  );
}

/** Loads whether a form is published, so "Open" can say why it's disabled. */
async function JobStatusActionsSlot({ companySlug, job }: { companySlug: string; job: { slug: string; status: 'draft' | 'open' | 'closed' } }) {
  const published = await hasPublishedForm(companySlug, job.slug);
  return (
    <JobStatusActions companySlug={companySlug} jobSlug={job.slug} status={job.status} hasPublishedForm={published} />
  );
}
