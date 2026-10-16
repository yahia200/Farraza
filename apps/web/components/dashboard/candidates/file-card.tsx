'use client';

import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import type { PreviewKind } from '@repo/shared';
import { Button } from '@/components/ui/button';
import { usePdfPreviewSupported } from '@/hooks/use-pdf-preview-supported';
import { DownloadFileButton } from './download-file-button';
import { DocxViewer, PdfViewer, type ViewerFile } from './file-viewers';

/**
 * One file's card: the row the server renders (`children`: icon, name, details), a Download button
 * that is always there, and, for a file the sheet can show inline, a Preview toggle that opens the
 * viewer under the row.
 *
 * The viewer opens on request, not with the sheet: the link is minted and the bytes are fetched only
 * for a CV someone actually wants to read. To teach it a new kind (image, video, audio), add the
 * kind to `previewKindOf` in @repo/shared and a case in `Viewer` below.
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
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const pdfSupported = usePdfPreviewSupported();
  // Where the browser can't show PDFs, Download is the only action (and the visible fallback).
  const canPreview = kind === 'docx' || (kind === 'pdf' && pdfSupported);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-3">
      {/* The buttons drop under the name when the sheet is narrow, instead of squeezing it. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-44 items-center gap-3">{children}</div>
        <div className="ml-auto flex items-center gap-2">
          {canPreview && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={`${open ? 'Hide preview of' : 'Preview'} ${file.fileName}`}
            >
              {open ? <EyeOffIcon data-icon="inline-start" /> : <EyeIcon data-icon="inline-start" />}
              {open ? 'Hide' : 'Preview'}
            </Button>
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
      {canPreview && open && (
        <div id={panelId}>
          <Viewer kind={kind} file={file} />
        </div>
      )}
    </div>
  );
}

function Viewer({ kind, file }: { kind: PreviewKind | null; file: ViewerFile }) {
  switch (kind) {
    case 'pdf':
      return <PdfViewer file={file} />;
    case 'docx':
      return <DocxViewer file={file} />;
    default:
      return null;
  }
}
