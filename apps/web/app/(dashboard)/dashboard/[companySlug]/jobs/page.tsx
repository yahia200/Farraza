import type { Metadata } from "next";
import { BriefcaseBusinessIcon } from "lucide-react";
import { canManageJobs } from "@repo/shared";
import { CompanyPage, PageTitle } from "@/components/dashboard/company-page";
import type { JobRow } from "@/components/dashboard/jobs/data-table-features";
import { JobsTable } from "@/components/dashboard/jobs/jobs-table";
import { NewJobDialog } from "@/components/dashboard/jobs/new-job-dialog";
import {
  PageHeaderSkeleton,
  SkeletonGroup,
  TableSkeleton,
} from "@/components/dashboard/skeletons";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getJobs, type MyCompany } from "@/lib/dal";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Jobs · Farraza" };

export default function JobsPage({
  params,
}: PageProps<"/dashboard/[companySlug]/jobs">) {
  return (
    <CompanyPage
      params={params}
      fallback={
        <SkeletonGroup label="Loading jobs" className="flex flex-col gap-4">
          <PageHeaderSkeleton />
          <TableSkeleton columns={4} />
        </SkeletonGroup>
      }
    >
      {(company) => <Jobs company={company} />}
    </CompanyPage>
  );
}

async function Jobs({ company }: { company: MyCompany }) {
  const jobs = await getJobs(company.slug);
  // Formatted on the server (lib/format.ts) so it can't differ from the browser's.
  const rows: JobRow[] = jobs.map((job) => ({
    ...job,
    createdLabel: formatDate(job.createdAt),
  }));

  // Same rule the API's JobPolicy uses (@repo/shared).
  const canManage = canManageJobs(company.role);

  // No jobs at all (not a filtered-out list): one empty state with the call to
  // action. The header's "New job" button is left out here so only one
  // NewJobDialog is mounted: its field ids must stay unique across the page.
  if (rows.length === 0) {
    return (
      <>
        <PageTitle title="Jobs" description="Draft, open and closed roles." />
        <div>
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BriefcaseBusinessIcon />
              </EmptyMedia>
              <EmptyTitle>No jobs yet</EmptyTitle>
              <EmptyDescription>
                {canManage
                  ? "Create your first job, build its application form, then open it to start receiving candidates."
                  : "Nobody has created a job yet. Jobs will show up here once an admin adds one."}
              </EmptyDescription>
            </EmptyHeader>
            {canManage && (
              <EmptyContent>
                <NewJobDialog companySlug={company.slug} />
              </EmptyContent>
            )}
          </Empty>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title="Jobs" description="Draft, open and closed roles." />
        {canManage && <NewJobDialog companySlug={company.slug} />}
      </div>
      <JobsTable data={rows} meta={{ companySlug: company.slug }} />
    </>
  );
}
