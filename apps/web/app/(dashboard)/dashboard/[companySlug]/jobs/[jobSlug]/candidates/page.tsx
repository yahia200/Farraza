import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CandidateDetail, CandidateDetailSkeleton } from '@/components/dashboard/candidates/candidate-detail';
import { CandidateSheet } from '@/components/dashboard/candidates/candidate-sheet';
import { CandidatesTable } from '@/components/dashboard/candidates/candidates-table';
import type { CandidateRow } from '@/components/dashboard/candidates/data-table-features';
import { JobPage, type LoadedJob } from '@/components/dashboard/jobs/job-page';
import { Skeleton } from '@/components/ui/skeleton';
import { getApplications, type MyCompany } from '@/lib/dal';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Candidates · Khatwateen' };

/**
 * Everyone who applied to the job, read-only for now (moving between stages
 * comes with the pipeline board). Every member can view it, interviewers too.
 * ?application=<id> opens one candidate in a side sheet.
 */
export default function JobCandidatesPage({
  params,
  searchParams,
}: PageProps<'/dashboard/[companySlug]/jobs/[jobSlug]/candidates'>) {
  return (
    <JobPage params={params} fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
      {(company, job) => <Candidates company={company} job={job} searchParams={searchParams} />}
    </JobPage>
  );
}

async function Candidates({
  company,
  job,
  searchParams,
}: {
  company: MyCompany;
  job: LoadedJob;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [applications, { application }] = await Promise.all([getApplications(company.slug, job.slug), searchParams]);
  // Formatted on the server (lib/format.ts) so it can't differ from the browser's.
  const rows: CandidateRow[] = applications.map((row) => ({ ...row, appliedLabel: formatDate(row.submittedAt) }));
  const basePath = `/dashboard/${company.slug}/jobs/${job.slug}/candidates`;
  const selected = typeof application === 'string' ? application : undefined;

  return (
    <>
      <CandidatesTable data={rows} stages={job.stages} meta={{ basePath }} />
      <CandidateSheet open={selected !== undefined} closeHref={basePath}>
        {selected && (
          // Keyed by id, so opening another candidate shows the skeleton again.
          <Suspense key={selected} fallback={<CandidateDetailSkeleton />}>
            <CandidateDetail companySlug={company.slug} jobSlug={job.slug} applicationId={selected} />
          </Suspense>
        )}
      </CandidateSheet>
    </>
  );
}
