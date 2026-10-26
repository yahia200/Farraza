'use client';

import {
  FileAudioIcon,
  FileIcon,
  FileImageIcon,
  FileTextIcon,
  FileVideoIcon,
  FileWarningIcon,
  RotateCcwIcon,
  XIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment';
import { Spinner } from '@/components/ui/spinner';
import { formatFileSize } from '@/lib/format';

/** The shadcn Attachment states a file being picked and sent goes through (`idle` is for an empty placeholder). */
export type FileUploadState = 'uploading' | 'processing' | 'error' | 'done';

/** The icon for a file's content type: image, audio and video get their own, documents a page, anything else a plain file. */
function FileTypeIcon({ contentType }: { contentType: string }) {
  if (contentType.startsWith('image/')) return <FileImageIcon aria-hidden="true" />;
  if (contentType.startsWith('audio/')) return <FileAudioIcon aria-hidden="true" />;
  if (contentType.startsWith('video/')) return <FileVideoIcon aria-hidden="true" />;
  if (
    contentType === 'application/pdf' ||
    contentType.startsWith('text/') ||
    contentType.includes('wordprocessingml') ||
    contentType === 'application/msword'
  ) {
    return <FileTextIcon aria-hidden="true" />;
  }
  return <FileIcon aria-hidden="true" />;
}

/**
 * One chosen file as a shadcn Attachment (https://ui.shadcn.com/docs/components/base/attachment):
 * a file-type icon, name, a line under it, and Remove (plus Try again when it failed). The
 * Attachment's `state` drives the look: the name shimmers while uploading or processing, and an
 * error is red. An upload reads like the docs' first example: a spinner, "Uploading · 64%" under
 * the name, and a button that cancels it. There is no progress bar.
 * Show several in an `AttachmentGroup` or a plain column. It only displays; the consumer owns the
 * upload and passes its progress in (`FileDropzone` is the picker that goes with it).
 */
export function FileUploadItem({
  name,
  sizeBytes,
  contentType,
  state,
  percent,
  description,
  onRemove,
  onRetry,
}: {
  /** The user's own file name: React escapes it, and it can be long (it is truncated, with the full name on hover). */
  name: string;
  sizeBytes: number;
  /** The file's content type, which picks the icon. */
  contentType: string;
  state: FileUploadState;
  /** 0 to 100, for `state` `uploading`: the default line under the name is "Uploading · 64%". */
  percent?: number;
  /** The line under the name; defaults to the upload progress, else the size. An error's message goes here. */
  description?: ReactNode;
  /** Shows the Remove button (Cancel upload while `state` is `uploading`). */
  onRemove?: () => void;
  /** Shows Try again, only for `state` `error`. */
  onRetry?: () => void;
}) {
  return (
    <Attachment state={state} className="w-full">
      <AttachmentMedia>
        {state === 'processing' || state === 'uploading' ? (
          // Spinner is a status role by default; the line under the name already says what is going on.
          <Spinner aria-hidden="true" role="presentation" />
        ) : state === 'error' ? (
          <FileWarningIcon aria-hidden="true" />
        ) : (
          <FileTypeIcon contentType={contentType} />
        )}
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle title={name}>{name}</AttachmentTitle>
        {/* The percent changes many times a second; the caller's live region must not read each one out. */}
        <AttachmentDescription aria-live={state === 'uploading' ? 'off' : undefined}>
          {description ??
            (state === 'uploading'
              ? `Uploading${percent !== undefined ? ` · ${percent}%` : ''}`
              : formatFileSize(sizeBytes))}
        </AttachmentDescription>
      </AttachmentContent>
      {(onRemove || (state === 'error' && onRetry)) && (
        <AttachmentActions>
          {state === 'error' && onRetry && (
            <AttachmentAction size="icon-sm" aria-label={`Try uploading ${name} again`} onClick={onRetry}>
              <RotateCcwIcon />
            </AttachmentAction>
          )}
          {onRemove && (
            <AttachmentAction size="icon-sm" aria-label={state === 'uploading' ? `Cancel uploading ${name}` : `Remove ${name}`} onClick={onRemove}>
              <XIcon />
            </AttachmentAction>
          )}
        </AttachmentActions>
      )}
    </Attachment>
  );
}
