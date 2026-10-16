import { FileTextIcon } from 'lucide-react';
import type { ApplicationFileView } from '@/lib/dal';
import { formatFileSize } from '@/lib/format';
import { DownloadFileButton } from './download-file-button';
import { fileTypeLabel, formatDuration } from './file-type-label';

/**
 * One file an applicant sent: its name, type, size (and length, for video and audio) with a
 * download button. A Server Component; only the button is a client component.
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
  const details = [
    fileTypeLabel(file.mimeType),
    formatFileSize(file.sizeBytes),
    ...(file.durationSeconds ? [formatDuration(file.durationSeconds)] : []),
  ];

  return (
    <div className="flex items-center gap-3 rounded-2xl border p-3">
      <FileTextIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* The name is the applicant's own text: React escapes it, and it can be long. */}
        <span className="truncate font-medium text-foreground" title={file.originalName}>
          {file.originalName}
        </span>
        <span className="text-sm text-muted-foreground">{details.join(' · ')}</span>
      </div>
      <DownloadFileButton
        companySlug={companySlug}
        jobSlug={jobSlug}
        applicationId={applicationId}
        fileId={file.id}
        fileName={file.originalName}
      />
    </div>
  );
}
