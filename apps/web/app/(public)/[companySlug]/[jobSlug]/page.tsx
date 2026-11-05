export const instant = false;

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ApplyForm } from '@/components/apply/apply-form';
import { Card, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getPublicJob } from '@/lib/public-jobs';

/**
 * The public apply page, /{companySlug}/{jobSlug} (the URL in docs/db-schema.md).
 * Only open jobs with a published form exist here; anything else is a 404.
 * Fixed routes such as /dashboard/… win over this one, which is why some
 * company slugs are reserved (RESERVED_COMPANY_SLUGS in @repo/shared).
 */

// The slug CHECK constraints in apps/api/src/prisma/contract.prisma. Anything
// else can't exist, so it's a 404 without asking the API (or caching the miss).
const SLUG = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/;

function loadJob(companySlug: string, jobSlug: string) {
  if (!SLUG.test(companySlug) || !SLUG.test(jobSlug)) {
    return null;
  }
  return getPublicJob(companySlug, jobSlug);
}

export async function generateMetadata({ params }: PageProps<'/[companySlug]/[jobSlug]'>): Promise<Metadata> {
  const { companySlug, jobSlug } = await params;
  const data = await loadJob(companySlug, jobSlug);
  if (!data) {
    return { title: 'Job not found · Farraza' };
  }
  const { company, job } = data;
  return {
    title: `${job.title} at ${company.name}`,
    description: job.description?.slice(0, 160) ?? `Apply for ${job.title} at ${company.name}.`,
  };
}

export default function ApplyPage({ params, searchParams }: PageProps<'/[companySlug]/[jobSlug]'>) {
  // params and searchParams are request data, so the page renders inside
  // Suspense (cacheComponents); the job data itself comes from the cache.
  return (
    <Suspense fallback={<ApplySkeleton />}>
      <Apply params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Apply({ params, searchParams }: PageProps<'/[companySlug]/[jobSlug]'>) {
  const { companySlug, jobSlug } = await params;
  const data = await loadJob(companySlug, jobSlug);
  if (!data) {
    notFound();
  }
  const { company, job, cvMode, fields } = data;
  const { utm_source } = await searchParams;

  return (
    // Same frame as the company page (/{companySlug}).
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
      <ApplyForm
        company={company}
        jobSlug={jobSlug}
        jobTitle={job.title}
        jobDescription={job.description}
        cvMode={cvMode}
        fields={fields}
        source={typeof utm_source === 'string' ? utm_source : undefined}
      />
    </main>
  );
}

/** Fixed sizes only: no Math.random() in anything prerendered. */
function ApplySkeleton() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
      <Card className="w-full" aria-busy="true">
        <span className="sr-only">Loading application</span>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardFooter>
          <Skeleton className="h-8 w-28" />
        </CardFooter>
      </Card>
    </main>
  );
}
