import type { Metadata } from 'next';
import { canManageJobs, DEFAULT_CV_MODE } from '@repo/shared';
import { FormBuilder } from '@/components/dashboard/jobs/form-builder/form-builder';
import { JobPageTransition } from '@/components/dashboard/jobs/job-page-transition';
import { JobPage } from '@/components/dashboard/jobs/job-page';
import { getJobForm } from '@/lib/dal';

export const metadata: Metadata = { title: 'Application form · Farraza' };

/**
 * The job's application form builder. Starts from the draft if there is one,
 * otherwise from the published version (editing that creates a new draft).
 */
export default function JobFormPage({ params }: PageProps<'/dashboard/[companySlug]/jobs/[jobSlug]/form'>) {
  return (
    <JobPageTransition>
      <JobPage params={params}>
        {(company, job) => (
          <Builder companySlug={company.slug} jobSlug={job.slug} canEdit={canManageJobs(company.role)} />
        )}
      </JobPage>
    </JobPageTransition>
  );
}

async function Builder({ companySlug, jobSlug, canEdit }: { companySlug: string; jobSlug: string; canEdit: boolean }) {
  const { draft, published } = await getJobForm(companySlug, jobSlug);
  return (
    <FormBuilder
      // A fresh builder (and default values) whenever the saved form changes.
      key={`${draft?.updatedAt ?? ''}|${published?.version ?? ''}`}
      companySlug={companySlug}
      jobSlug={jobSlug}
      initialFields={(draft ?? published)?.fields ?? []}
      // A brand-new job's form starts by asking for an optional CV; once a version exists, keep its setting.
      initialCvMode={(draft ?? published)?.cvMode ?? DEFAULT_CV_MODE}
      status={{ publishedVersion: published?.version ?? null, hasDraft: draft !== null }}
      canEdit={canEdit}
    />
  );
}
