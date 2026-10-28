import { canManageJobs, canMoveApplications, highlightableQuestions } from '@repo/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CandidateDetail, CandidateDetailSkeleton } from '@/components/dashboard/candidates/candidate-detail';
import { CandidateSheet } from '@/components/dashboard/candidates/candidate-sheet';
import { candidatesHref, parseView } from '@/components/dashboard/candidates/candidates-href';
import { CandidatesTable } from '@/components/dashboard/candidates/candidates-table';
import { CandidatesViewToggle } from '@/components/dashboard/candidates/candidates-view-toggle';
import type { CandidateRow } from '@/components/dashboard/candidates/data-table-features';
import { HighlightedQuestionsPicker } from '@/components/dashboard/candidates/highlighted-questions-picker';
import { PipelineBoard } from '@/components/dashboard/candidates/pipeline-board';
import { RatingCriteriaPicker } from '@/components/dashboard/candidates/rating-criteria-picker';
import { JobPageTransition } from '@/components/dashboard/jobs/job-page-transition';
import { JobPage, type LoadedJob } from '@/components/dashboard/jobs/job-page';
import { Skeleton } from '@/components/ui/skeleton';
import {
  flattenBoard,
  getJobForm,
  getPipelineBoard,
  type HighlightedQuestion,
  type MyCompany,
  type PipelineColumn,
  toHighlightedQuestion,
} from '@/lib/dal';

export const metadata: Metadata = { title: 'Candidates · Farraza' };

/**
 * Everyone who applied to the job. Every member can view it, interviewers
 * too; those who can move candidates (canMoveApplications) can also do so
 * from the board (drag, or the card's Select) and from the detail sheet.
 * ?view=table|board picks the view (table by default); ?application=<id>
 * opens one candidate in a side sheet, in either view. Those who can manage
 * jobs (canManageJobs) also get the Highlighted questions picker beside the
 * view toggle, once the job has a published form, and the rating Criteria
 * picker, which needs no form (the catalog is fixed).
 */
export default function JobCandidatesPage({
  params,
  searchParams,
}: PageProps<'/dashboard/[companySlug]/jobs/[jobSlug]/candidates'>) {
  return (
    <JobPageTransition>
      <JobPage params={params} fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
        {(company, job) => <Candidates company={company} job={job} searchParams={searchParams} />}
      </JobPage>
    </JobPageTransition>
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
  const canManage = canManageJobs(company.role);
  // One fetch of the board feeds both views. The form is read only for the
  // Highlighted questions picker, which interviewers don't get.
  const [{ columns, highlightedQuestions }, { application, view: viewParam }, form] = await Promise.all([
    getPipelineBoard(company.slug, job.slug),
    searchParams,
    canManage ? getJobForm(company.slug, job.slug) : null,
  ]);
  const view = parseView(viewParam);
  const basePath = `/dashboard/${company.slug}/jobs/${job.slug}/candidates`;
  const selected = typeof application === 'string' ? application : undefined;
  // The latest published form's Questions, never the draft's: the list shows what applicants are asked now.
  const pickerQuestions = form?.published
    ? highlightableQuestions(form.published.fields).map(toHighlightedQuestion)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <CandidatesViewToggle basePath={basePath} view={view} application={selected} />
        {pickerQuestions && (
          <HighlightedQuestionsPicker
            companySlug={company.slug}
            jobSlug={job.slug}
            questions={pickerQuestions}
            savedKeys={job.highlightedQuestionKeys}
          />
        )}
        {canManage && (
          <RatingCriteriaPicker companySlug={company.slug} jobSlug={job.slug} savedKeys={job.ratingCriteria} />
        )}
      </div>
      {view === 'board' ? (
        <PipelineBoard
          columns={columns}
          highlightedQuestions={highlightedQuestions}
          basePath={basePath}
          companySlug={company.slug}
          jobSlug={job.slug}
          canMove={canMoveApplications(company.role)}
        />
      ) : (
        <TableView
          columns={columns}
          highlightedQuestions={highlightedQuestions}
          stages={job.stages}
          basePath={basePath}
        />
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
              ratingCriteria={job.ratingCriteria}
            />
          </Suspense>
        )}
      </CandidateSheet>
    </div>
  );
}

function TableView({
  columns,
  highlightedQuestions,
  stages,
  basePath,
}: {
  columns: PipelineColumn[];
  highlightedQuestions: HighlightedQuestion[];
  stages: LoadedJob['stages'];
  basePath: string;
}) {
  // `appliedLabel` was formatted on the server by the DAL (lib/format.ts), so it can't differ from the browser's.
  const rows: CandidateRow[] = flattenBoard(columns);
  return (
    <CandidatesTable
      data={rows}
      stages={stages}
      highlightedQuestions={highlightedQuestions}
      meta={{ basePath }}
    />
  );
}
