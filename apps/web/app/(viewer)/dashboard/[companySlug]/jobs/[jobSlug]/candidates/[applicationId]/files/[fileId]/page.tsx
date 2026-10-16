import { ArrowLeftIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { previewKindOf } from '@repo/shared';
import { candidatesHref } from '@/components/dashboard/candidates/candidates-href';
import { fileDetails } from '@/components/dashboard/candidates/candidate-file';
import { DownloadFileButton } from '@/components/dashboard/candidates/download-file-button';
import { FileViewer } from '@/components/dashboard/candidates/file-viewers';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getApplication, getApplicationFiles } from '@/lib/dal';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'File preview · Khatwateen' };

/**
 * One CV or attachment on a page of its own, opened in a new tab from the candidate sheet's
 * Preview link. The slim header names the file and candidate and keeps Download and a way back to
 * the candidate; the viewer fills the rest of the window.
 *
 * The params are awaited inside <Suspense> so the shell stays static (01-getting-started/08-caching.md).
 */
export default function FilePreviewPage({
  params,
}: PageProps<'/dashboard/[companySlug]/jobs/[jobSlug]/candidates/[applicationId]/files/[fileId]'>) {
  return (
    <Suspense fallback={<PreviewSkeleton />}>
      <FilePreview params={params} />
    </Suspense>
  );
}

async function FilePreview({
  params,
}: {
  params: PageProps<'/dashboard/[companySlug]/jobs/[jobSlug]/candidates/[applicationId]/files/[fileId]'>['params'];
}) {
  const { companySlug, jobSlug, applicationId, fileId } = await params;

  // The application first: the API answers 404 to non-members and for an application outside this
  // job, which is the page's 404. The files list then only has to be searched for the id.
  const application = await getApplication(companySlug, jobSlug, applicationId);
  if (!application) notFound();
  const file = (await getApplicationFiles(companySlug, jobSlug, applicationId)).find((f) => f.id === fileId);
  if (!file) notFound();

  const backHref = candidatesHref(`/dashboard/${companySlug}/jobs/${jobSlug}/candidates`, {
    view: 'table',
    application: application.id,
  });

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Link
          href={backHref}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'shrink-0')}
          aria-label={`Open ${application.candidate.name}'s application`}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          <span className="hidden sm:inline">Candidate</span>
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          {/* The name is the applicant's own text: React escapes it, and it can be long. */}
          <h1 className="truncate text-sm font-medium" title={file.originalName}>
            {file.originalName}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {application.candidate.name} · {fileDetails(file)}
          </p>
        </div>
        <DownloadFileButton
          companySlug={companySlug}
          jobSlug={jobSlug}
          applicationId={application.id}
          fileId={file.id}
          fileName={file.originalName}
        />
      </header>
      <main className="flex-1 p-4">
        <FileViewer
          kind={previewKindOf(file.mimeType)}
          file={{
            companySlug,
            jobSlug,
            applicationId: application.id,
            fileId: file.id,
            fileName: file.originalName,
            sizeBytes: file.sizeBytes,
          }}
        />
      </main>
    </>
  );
}

/** Fixed sizes only: no Math.random() in anything prerendered. */
function PreviewSkeleton() {
  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-56" />
      </header>
      <main className="flex-1 p-4">
        <Skeleton className="h-[calc(100dvh-5.5rem)] min-h-80 w-full rounded-xl" />
      </main>
    </>
  );
}
