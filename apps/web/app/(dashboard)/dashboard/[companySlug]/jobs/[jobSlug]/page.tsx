import type { Metadata } from 'next';
import { canManageJobs } from '@repo/shared';
import { JobDetailsForm } from '@/components/dashboard/jobs/job-details-form';
import { JobPageTransition } from '@/components/dashboard/jobs/job-page-transition';
import { JobPage } from '@/components/dashboard/jobs/job-page';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Job · Farraza' };

/** Overview: edit the title and description; see the dates and pipeline stages. */
export default function JobOverviewPage({ params }: PageProps<'/dashboard/[companySlug]/jobs/[jobSlug]'>) {
  return (
    <JobPageTransition>
      <JobPage params={params}>
        {(company, job) => (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
            {/* key: fresh default values if the job changes underneath. */}
            <JobDetailsForm key={job.id} companySlug={company.slug} job={job} canEdit={canManageJobs(company.role)} />
            <aside className="space-y-6 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDate(job.createdAt)}</dd>
                {job.openedAt && (
                  <>
                    <dt className="text-muted-foreground">Opened</dt>
                    <dd>{formatDate(job.openedAt)}</dd>
                  </>
                )}
                {job.closedAt && (
                  <>
                    <dt className="text-muted-foreground">Closed</dt>
                    <dd>{formatDate(job.closedAt)}</dd>
                  </>
                )}
              </dl>
              <div className="space-y-2">
                <h2 className="font-medium">Pipeline stages</h2>
                <ol className="flex flex-wrap gap-1.5" aria-label="Pipeline stages, in order">
                  {[...job.stages]
                    .sort((a, b) => a.position - b.position)
                    .map((stage) => (
                      <li key={stage.id}>
                        <Badge variant={stage.kind === 'normal' ? 'secondary' : 'outline'}>{stage.name}</Badge>
                      </li>
                    ))}
                </ol>
              </div>
            </aside>
          </div>
        )}
      </JobPage>
    </JobPageTransition>
  );
}
