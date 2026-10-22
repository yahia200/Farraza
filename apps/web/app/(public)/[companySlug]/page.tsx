export const instant = false;

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowRightIcon, BriefcaseIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { getCompanyJobs } from '@/lib/public-jobs';

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

export async function generateMetadata({ params }: PageProps<'/[companySlug]'>): Promise<Metadata> {
  const { companySlug } = await params;
  const data = await loadCompany(companySlug);
  if (!data) {
    return { title: 'Company not found · Farraza' };
  }
  return {
    title: `Jobs at ${data.company.name}`,
    description: `Open positions at ${data.company.name}. Apply directly.`,
  };
}

export default function CompanyJobsPage({ params }: PageProps<'/[companySlug]'>) {
  // params is request data, so the page renders inside Suspense
  // (cacheComponents); the listing itself comes from the shared cache.
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-14">
      <Suspense fallback={<CompanyJobsSkeleton />}>
        <CompanyJobs params={params} />
      </Suspense>
    </main>
  );
}

async function CompanyJobs({ params }: { params: PageProps<'/[companySlug]'>['params'] }) {
  const { companySlug } = await params;
  const data = await loadCompany(companySlug);
  if (!data) {
    notFound();
  }
  const { company, jobs } = data;

  return (
    <div className="flex flex-col gap-8">
      {/*
        The header is a shadcn Card: its own surface floating on the brand-
        colored page background, so the text uses the normal card foreground
        tokens (no --brand-fg needed — that's only for text sitting directly on
        the brand color). The company name stays an <h1>, styled as the card
        title, so the public page keeps its heading.
      */}
      <Card className="items-center text-center">
        <CardContent className="flex flex-col items-center gap-4">
          <Avatar className="size-14 rounded-xl">
            {company.logoUrl ? <AvatarImage src={company.logoUrl} alt="" /> : null}
            <AvatarFallback className="rounded-xl text-lg">
              {company.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            {/* An <h1> (the page's heading) styled as the card title — this
                repo's CardTitle is a div with no asChild, so we match its look
                rather than nest it. */}
            <h1 className="font-heading text-2xl font-medium">{company.name}</h1>
            <CardDescription>
              {jobs.length === 1 ? '1 open position' : `${jobs.length} open positions`}
            </CardDescription>
          </div>
        </CardContent>
      </Card>

      {jobs.length === 0 ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BriefcaseIcon />
            </EmptyMedia>
            <EmptyTitle>No open positions right now</EmptyTitle>
            <EmptyDescription>
              {company.name} isn&apos;t accepting applications at the moment. Check back later.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <li key={job.slug}>
              <Link href={`/${companySlug}/${job.slug}`} className="group block">
                <Card className="transition-colors group-hover:border-primary/40">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-3">
                      <span>{job.title}</span>
                      <ArrowRightIcon className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </CardTitle>
                    {job.description ? (
                      <CardDescription className="line-clamp-2">{job.description}</CardDescription>
                    ) : null}
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Fixed sizes only: no Math.random() in anything prerendered. */
function CompanyJobsSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <Card className="items-center text-center">
        <CardContent className="flex flex-col items-center gap-4">
          <Skeleton className="size-14 rounded-xl" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-28" />
        </CardContent>
      </Card>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}
