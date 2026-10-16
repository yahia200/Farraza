'use client';

import { EyeIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PreviewKind } from '@repo/shared';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePdfPreviewSupported } from '@/hooks/use-pdf-preview-supported';
import { DownloadFileButton } from './download-file-button';
import { filePreviewHref } from './file-preview-href';
import type { ViewerFile } from './file-viewers';

/**
 * One file's card: the row the server renders (`children`: icon, name, details), a Download button
 * that is always there, and, for a file the browser can show, a Preview link that opens the file's
 * own page (app/(viewer)/…) in a new tab.
 *
 * Nothing is fetched here: the preview page mints the view link and loads the bytes when it opens, so
 * the sheet stays light however many files an application has. To teach it a new kind, see
 * `FileViewer` in file-viewers.tsx.
 */
export function FileCard({
  kind,
  file,
  children,
}: {
  /** From `previewKindOf(mimeType)`; null means download only. */
  kind: PreviewKind | null;
  file: ViewerFile;
  children: ReactNode;
}) {
  const pdfSupported = usePdfPreviewSupported();
  // Where the browser can't show PDFs, Download is the only action (and the visible fallback).
  const canPreview =
    kind === 'docx' || kind === 'image' || kind === 'video' || kind === 'audio' || (kind === 'pdf' && pdfSupported);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-3">
      {/* The buttons drop under the name when the sheet is narrow, instead of squeezing it. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-44 items-center gap-3">{children}</div>
        <div className="ml-auto flex items-center gap-2 text-primary">
          {canPreview && (
            // A real link, so "open in new tab" and middle-click work. `target="_blank"` already
            // implies `rel="noopener"` in current browsers; the explicit rel keeps older ones safe.
            <Link
              href={filePreviewHref(file)}
              target="_blank"
              rel="noopener"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              aria-label={`Preview ${file.fileName} (opens in a new tab)`}
            >
              <EyeIcon data-icon="inline-start" />
              Preview
            </Link>
          )}
          <DownloadFileButton
            companySlug={file.companySlug}
            jobSlug={file.jobSlug}
            applicationId={file.applicationId}
            fileId={file.fileId}
            fileName={file.fileName}
          />
        </div>
      </div>
    </div>
  );
}
