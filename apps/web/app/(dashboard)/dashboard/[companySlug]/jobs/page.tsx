import type { Metadata } from 'next';
import { canManageJobs } from '@repo/shared';
import { CompanyPage, PageTitle } from '@/components/dashboard/company-page';
import type { JobRow } from '@/components/dashboard/jobs/data-table-features';
import { JobsTable } from '@/components/dashboard/jobs/jobs-table';
import { NewJobDialog } from '@/components/dashboard/jobs/new-job-dialog';
import { getJobs, type MyCompany } from '@/lib/dal';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Jobs · Khatwateen' };

export default function JobsPage({ params }: PageProps<'/dashboard/[companySlug]/jobs'>) {
  return <CompanyPage params={params}>{(company) => <Jobs company={company} />}</CompanyPage>;
}

async function Jobs({ company }: { company: MyCompany }) {
  const jobs = await getJobs(company.slug);
  // Formatted on the server (lib/format.ts) so it can't differ from the browser's.
  const rows: JobRow[] = jobs.map((job) => ({ ...job, createdLabel: formatDate(job.createdAt) }));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title="Jobs" description="Draft, open and closed roles." />
        {/* Same rule the API's JobPolicy uses (@repo/shared). */}
        {canManageJobs(company.role) && <NewJobDialog companySlug={company.slug} />}
      </div>
      <JobsTable data={rows} meta={{ companySlug: company.slug }} />
    </>
  );
}
