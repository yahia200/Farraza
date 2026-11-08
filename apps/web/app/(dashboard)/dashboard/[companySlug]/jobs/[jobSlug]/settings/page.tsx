import type { Metadata } from 'next';
import Link from 'next/link';
import { canManageJobs } from '@repo/shared';
import { JobPage, type LoadedJob } from '@/components/dashboard/jobs/job-page';
import { JobPageTransition } from '@/components/dashboard/jobs/job-page-transition';
import { RatingCriteriaSection } from '@/components/dashboard/jobs/settings/rating-criteria-section';
import { RequirementsEditor } from '@/components/dashboard/jobs/settings/requirements-editor';
import { ScreeningRulesEditor } from '@/components/dashboard/jobs/settings/screening-rules-editor';
import { JobSettingsSkeleton } from '@/components/dashboard/skeletons';
import { getJobForm, type MyCompany } from '@/lib/dal';

export const metadata: Metadata = { title: 'Job settings · Farraza' };

/**
 * The job's settings: Screening rules and rating Criteria. Only people who can manage jobs
 * (canManageJobs) get the editors; interviewers see a note instead. The rules are about the latest
 * published form, never the draft, because that is what applicants answer and what the API checks.
 */
export default function JobSettingsPage({ params }: PageProps<'/dashboard/[companySlug]/jobs/[jobSlug]/settings'>) {
  return (
    <JobPageTransition>
      <JobPage params={params} fallback={<JobSettingsSkeleton />}>
        {(company, job) => <Settings company={company} job={job} />}
      </JobPage>
    </JobPageTransition>
  );
}

async function Settings({ company, job }: { company: MyCompany; job: LoadedJob }) {
  if (!canManageJobs(company.role)) {
    return (
      <p className="max-w-3xl rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
        Only admins and recruiters can change a job&apos;s requirements, screening rules and rating criteria.
      </p>
    );
  }

  const { published } = await getJobForm(company.slug, job.slug);

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <section aria-labelledby="screening-rules-title" className="flex flex-col gap-3">
        <div className="space-y-1">
          <h2 id="screening-rules-title" className="font-heading text-base font-semibold">
            Screening rules
          </h2>
          <p className="text-sm text-muted-foreground">
            Reject or flag an application from one answer. Each rule says which answers are fine: it applies when the
            answer is outside that. A skipped answer never applies a rule, so mark the question required if
            applicants must answer it. Rules are checked once, when an application is submitted, and changing them
            never affects applications already received.
          </p>
        </div>
        {published ? (
          <ScreeningRulesEditor
            key={published.version}
            companySlug={company.slug}
            jobSlug={job.slug}
            fields={published.fields}
            savedRules={job.screeningRules}
          />
        ) : (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Screening rules are about the questions on the application form, so the form comes first.{' '}
            <Link
              href={`/dashboard/${company.slug}/jobs/${job.slug}/form`}
              className="font-medium text-foreground underline underline-offset-4"
            >
              Build and publish the form
            </Link>
            , then come back.
          </p>
        )}
      </section>
      <section aria-labelledby="requirements-title" className="flex flex-col gap-3">
        <div className="space-y-1">
          <h2 id="requirements-title" className="font-heading text-base font-semibold">
            Requirements
          </h2>
          <p className="text-sm text-muted-foreground">
            What a candidate should have, each with the keywords that count as evidence in their CV. Candidates are
            checked against these and the result is shown to your team as advice: CV matching never rejects anyone.
            Editing requirements leaves the results already shown alone until you re-check candidates.
          </p>
        </div>
        <RequirementsEditor
          key={job.requirementsVersion}
          companySlug={company.slug}
          jobSlug={job.slug}
          savedRequirements={job.requirements}
          savedVersion={job.requirementsVersion}
          locked={job.requirementsLocked}
        />
      </section>
      <RatingCriteriaSection companySlug={company.slug} jobSlug={job.slug} savedKeys={job.ratingCriteria} />
    </div>
  );
}
