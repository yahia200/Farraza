'use client';

import { DownloadIcon } from 'lucide-react';
import { useTransition } from 'react';
import { getFileDownloadUrl, type FileDownloadResult } from '@/app/actions/applications';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';

/**
 * Downloads one of an application's files. A link lasts only a few minutes, so it is asked for
 * on each click (never rendered into the page, which is cached) and followed straight away.
 * The bucket answers with `Content-Disposition: attachment` and the applicant's file name,
 * so following the link saves the file and the page stays where it is: no `download`
 * attribute (browsers ignore it across origins) and no new tab.
 */
export function DownloadFileButton({
  companySlug,
  jobSlug,
  applicationId,
  fileId,
  fileName,
  iconOnly = false,
}: {
  companySlug: string;
  jobSlug: string;
  applicationId: string;
  fileId: string;
  /** For the accessible name only; the saved name comes from the bucket's header. */
  fileName: string;
  /** Just the icon, for inside a card (`FileCard`); the label is the accessible name. */
  iconOnly?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function download() {
    startTransition(async () => {
      let result: FileDownloadResult;
      try {
        result = await getFileDownloadUrl(companySlug, jobSlug, applicationId, fileId);
      } catch {
        // The request itself failed (offline, server down); no error boundary for a button.
        result = { formError: 'Check your connection and try again.' };
      }
      if (!result.url) {
        toast.add({ type: 'error', title: "Couldn't download the file", description: result.formError });
        return;
      }
      const link = document.createElement('a');
      link.href = result.url;
      link.rel = 'noopener';
      document.body.append(link);
      link.click();
      link.remove();
    });
  }

  return (
    <Button
      type="button"
      variant={iconOnly ? 'ghost' : 'outline'}
      size={iconOnly ? 'icon-sm' : 'sm'}
      onClick={download}
      disabled={pending}
      aria-label={`Download ${fileName}`}
    >
      {pending ? (
        <Spinner data-icon={iconOnly ? undefined : 'inline-start'} />
      ) : (
        <DownloadIcon data-icon={iconOnly ? undefined : 'inline-start'} />
      )}
      {!iconOnly && 'Download'}
    </Button>
  );
}
