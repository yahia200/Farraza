export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRightIcon, BriefcaseIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { getCompanyJobs } from "@/lib/public-jobs";

/**
 * The public listing of a company's open jobs, /{companySlug}. A sibling of the
 * apply page (/{companySlug}/{jobSlug}); each job here links to its apply page.
 * Only open jobs reach this list (the API filters by status). Fixed routes such
 * as /dashboard win over this dynamic segment, which is why some company slugs
 * are reserved (RESERVED_COMPANY_SLUGS in @repo/shared).
 */

// The company slug CHECK in apps/api/src/prisma/contract.prisma. Anything else
// can't exist, so it's a 404 without asking the API (or caching the miss).
const SLUG = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/;

function loadCompany(companySlug: string) {
  if (!SLUG.test(companySlug)) {
    return null;
  }
  return getCompanyJobs(companySlug);
}

export async function generateMetadata({
  params,
}: PageProps<"/[companySlug]">): Promise<Metadata> {
  const { companySlug } = await params;
  const data = await loadCompany(companySlug);
  if (!data) {
    return { title: "Company not found · Farraza" };
  }
  return {
    title: `Jobs at ${data.company.name}`,
    description: `Open positions at ${data.company.name}. Apply directly.`,
  };
}

export default function CompanyJobsPage({
  params,
}: PageProps<"/[companySlug]">) {
  // params is request data, so the page renders inside Suspense
  // (cacheComponents); the listing itself comes from the shared cache.
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
      <Suspense fallback={<CompanyJobsSkeleton />}>
        <CompanyJobs params={params} />
      </Suspense>
    </main>
  );
}

async function CompanyJobs({
  params,
}: {
  params: PageProps<"/[companySlug]">["params"];
}) {
  const { companySlug } = await params;
  const data = await loadCompany(companySlug);
  if (!data) {
    notFound();
  }
  const { company, jobs } = data;

  return (
      <Card className="w-full">
          <CardHeader >
            <CardTitle className="flex items-center gap-2">
              <Avatar>
                {company.logoUrl ? (
                  <AvatarImage src={company.logoUrl} alt="" />
                ) : null}
                <AvatarFallback>
                  {company.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h1 className="font-heading text-lg font-medium">
                {company.name}
              </h1>
            </CardTitle>
          </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BriefcaseIcon />
                </EmptyMedia>
                <EmptyTitle>No open positions right now</EmptyTitle>
                <EmptyDescription>
                  {company.name} isn&apos;t accepting applications at the
                  moment. Check back later.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {jobs.map((job) => (
                <li key={job.slug}>
                  <Link
                    href={`/${companySlug}/${job.slug}`}
                    className="group block"
                  >
                    <Card className="transition-colors shadow-none border">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between gap-3">
                          <span>{job.title}</span>
                          <ArrowRightIcon className="text-muted-foreground size-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                        </CardTitle>
                        {job.description ? (
                          <CardDescription className="line-clamp-1">
                            {job.description}
                          </CardDescription>
                        ) : null}
                      </CardHeader>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
  );
}

/** Fixed sizes only: no Math.random() in anything prerendered. */
function CompanyJobsSkeleton() {
  return (
    <Card className="w-full" aria-busy="true">
      <span className="sr-only">Loading jobs</span>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-6 w-40" />
        </div>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Card className="border shadow-none">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="size-5 shrink-0" />
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
