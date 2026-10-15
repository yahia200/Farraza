import { canMoveApplications } from '@repo/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CandidateDetail, CandidateDetailSkeleton } from '@/components/dashboard/candidates/candidate-detail';
import { CandidateSheet } from '@/components/dashboard/candidates/candidate-sheet';
import { candidatesHref, parseView } from '@/components/dashboard/candidates/candidates-href';
import { CandidatesTable } from '@/components/dashboard/candidates/candidates-table';
import { CandidatesViewToggle } from '@/components/dashboard/candidates/candidates-view-toggle';
import type { CandidateRow } from '@/components/dashboard/candidates/data-table-features';
import { PipelineBoard } from '@/components/dashboard/candidates/pipeline-board';
import { JobPage, type LoadedJob } from '@/components/dashboard/jobs/job-page';
import { Skeleton } from '@/components/ui/skeleton';
import { flattenBoard, getPipelineBoard, type MyCompany, type PipelineColumn } from '@/lib/dal';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Candidates · Khatwateen' };

/**
 * Everyone who applied to the job. Every member can view it, interviewers
 * too; those who can move candidates (canMoveApplications) can also do so
 * from the board (drag, or the card's Select) and from the detail sheet.
 * ?view=table|board picks the view (table by default); ?application=<id>
 * opens one candidate in a side sheet, in either view.
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
  // One fetch of the board feeds both views.
  const [columns, { application, view: viewParam }] = await Promise.all([
    getPipelineBoard(company.slug, job.slug),
    searchParams,
  ]);
  const view = parseView(viewParam);
  const basePath = `/dashboard/${company.slug}/jobs/${job.slug}/candidates`;
  const selected = typeof application === 'string' ? application : undefined;

  return (
    <div className="flex flex-col gap-4">
      <CandidatesViewToggle basePath={basePath} view={view} application={selected} />
      {view === 'board' ? (
        <PipelineBoard
          columns={columns}
          basePath={basePath}
          companySlug={company.slug}
          jobSlug={job.slug}
          canMove={canMoveApplications(company.role)}
        />
      ) : (
        <TableView columns={columns} stages={job.stages} basePath={basePath} />
      )}
      <CandidateSheet open={selected !== undefined} closeHref={candidatesHref(basePath, { view })}>
        {selected && (
          // Keyed by id, so opening another candidate shows the skeleton again.
          <Suspense key={selected} fallback={<CandidateDetailSkeleton />}>
            <CandidateDetail
              companySlug={company.slug}
              jobSlug={job.slug}
              applicationId={selected}
              stages={job.stages}
              canMove={canMoveApplications(company.role)}
            />
          </Suspense>
        )}
      </CandidateSheet>
    </div>
  );
}

function TableView({
  columns,
  stages,
  basePath,
}: {
  columns: PipelineColumn[];
  stages: LoadedJob['stages'];
  basePath: string;
}) {
  // Formatted on the server (lib/format.ts) so it can't differ from the browser's.
  const rows: CandidateRow[] = flattenBoard(columns).map((row) => ({
    ...row,
    appliedLabel: formatDate(row.submittedAt),
  }));
  return <CandidatesTable data={rows} stages={stages} meta={{ basePath }} />;
}
