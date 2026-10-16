import { FileTextIcon } from 'lucide-react';
import { fileTypeLabel, previewKindOf } from '@repo/shared';
import type { ApplicationFileView } from '@/lib/dal';
import { formatDuration, formatFileSize } from '@/lib/format';
import { FileCard } from './file-card';

/** "PDF · 1.2 MB · 2 min": what the sheet's row and the preview page's header say under the name. */
export function fileDetails(file: ApplicationFileView): string {
  return [
    fileTypeLabel(file.mimeType).split(' ')[0], // "PDF" from "PDF document"
    formatFileSize(file.sizeBytes),
    ...(file.durationSeconds ? [formatDuration(file.durationSeconds)] : []),
  ].join(' · ');
}

/**
 * One file an applicant sent: its name, type, size (and length, for video and audio), a download
 * button, and a link to the file's preview page for the types the browser can show. A Server
 * Component; the card around it (`FileCard`) is the client part, so the name and details are
 * rendered on the server.
 */
export function CandidateFile({
  file,
  companySlug,
  jobSlug,
  applicationId,
}: {
  file: ApplicationFileView;
  companySlug: string;
  jobSlug: string;
  applicationId: string;
}) {
  return (
    <FileCard
      kind={previewKindOf(file.mimeType)}
      file={{
        companySlug,
        jobSlug,
        applicationId,
        fileId: file.id,
        fileName: file.originalName,
        sizeBytes: file.sizeBytes,
      }}
    >
      <FileTextIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* The name is the applicant's own text: React escapes it, and it can be long. */}
        <span className="truncate font-medium text-foreground" title={file.originalName}>
          {file.originalName}
        </span>
        <span className="text-sm text-muted-foreground">{fileDetails(file)}</span>
      </div>
    </FileCard>
  );
}
