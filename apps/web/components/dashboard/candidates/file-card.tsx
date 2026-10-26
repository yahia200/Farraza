'use client';

import { FileTextIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PreviewKind } from '@repo/shared';
import {
  Attachment,
  AttachmentActions,
  AttachmentContent,
  AttachmentMedia,
  AttachmentTrigger,
} from '@/components/ui/attachment';
import { usePdfPreviewSupported } from '@/hooks/use-pdf-preview-supported';
import { DownloadFileButton } from './download-file-button';
import { filePreviewHref } from './file-preview-href';
import type { ViewerFile } from './file-viewers';

/**
 * One file's card, a shadcn Attachment (https://ui.shadcn.com/docs/components/base/attachment):
 * the text the server renders (`children`: an `AttachmentTitle` and `AttachmentDescription`) beside
 * a file icon, and a Download icon button that is always there. For a file the browser can show,
 * the whole card is a link (`AttachmentTrigger` rendered as a `Link`) that opens the file's own
 * page (app/(viewer)/…) in a new tab; the Download button sits above it (`AttachmentActions` is
 * `z-20`, the trigger `z-10`), so it never opens the preview.
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
    <Attachment className="w-full">
      <AttachmentMedia>
        <FileTextIcon aria-hidden="true" />
      </AttachmentMedia>
      <AttachmentContent>{children}</AttachmentContent>
      <AttachmentActions>
        <DownloadFileButton
          iconOnly
          companySlug={file.companySlug}
          jobSlug={file.jobSlug}
          applicationId={file.applicationId}
          fileId={file.fileId}
          fileName={file.fileName}
        />
      </AttachmentActions>
      {canPreview && (
        // A real link, so "open in new tab" and middle-click work. `target="_blank"` already
        // implies `rel="noopener"` in current browsers; the explicit rel keeps older ones safe.
        <AttachmentTrigger
          render={
            <Link
              href={filePreviewHref(file)}
              target="_blank"
              rel="noopener"
              aria-label={`Preview ${file.fileName} (opens in a new tab)`}
            />
          }
        />
      )}
    </Attachment>
  );
}
