'use client';

import { FileTextIcon, FileWarningIcon, RotateCcwIcon, XIcon } from 'lucide-react';
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
import { Progress, ProgressValue } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { formatFileSize } from '@/lib/format';

/** The shadcn Attachment states a file being picked and sent goes through (`idle` is for an empty placeholder). */
export type FileUploadState = 'uploading' | 'processing' | 'error' | 'done';

/**
 * One chosen file as a shadcn Attachment (https://ui.shadcn.com/docs/components/base/attachment):
 * icon, name, a line under it, and Remove (plus Try again when it failed). The Attachment's
 * `state` drives the look: the name shimmers while uploading or processing, and an error is red.
 * Show several in an `AttachmentGroup` or a plain column. It only displays; the consumer owns the
 * upload and passes its progress in (`FileDropzone` is the picker that goes with it).
 */
export function FileUploadItem({
  name,
  sizeBytes,
  state,
  percent,
  description,
  onRemove,
  onRetry,
}: {
  /** The user's own file name: React escapes it, and it can be long (it is truncated, with the full name on hover). */
  name: string;
  sizeBytes: number;
  state: FileUploadState;
  /** 0 to 100; the progress bar shows only while `state` is `uploading` and this is set. */
  percent?: number;
  /** The line under the name; defaults to the size. An error's message goes here. */
  description?: ReactNode;
  /** Shows the Remove button. */
  onRemove?: () => void;
  /** Shows Try again, only for `state` `error`. */
  onRetry?: () => void;
}) {
  return (
    <Attachment state={state} className="w-full">
      <AttachmentMedia>
        {state === 'processing' ? (
          // Spinner is a status role by default; the line under the name already says what is going on.
          <Spinner aria-hidden="true" role="presentation" />
        ) : state === 'error' ? (
          <FileWarningIcon aria-hidden="true" />
        ) : (
          <FileTextIcon aria-hidden="true" />
        )}
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle title={name}>{name}</AttachmentTitle>
        <AttachmentDescription>{description ?? formatFileSize(sizeBytes)}</AttachmentDescription>
      </AttachmentContent>
      {(onRemove || (state === 'error' && onRetry)) && (
        <AttachmentActions>
          {state === 'error' && onRetry && (
            <AttachmentAction size="icon-sm" aria-label={`Try uploading ${name} again`} onClick={onRetry}>
              <RotateCcwIcon />
            </AttachmentAction>
          )}
          {onRemove && (
            <AttachmentAction size="icon-sm" aria-label={`Remove ${name}`} onClick={onRemove}>
              <XIcon />
            </AttachmentAction>
          )}
        </AttachmentActions>
      )}
      {state === 'uploading' && percent !== undefined && (
        <Progress value={percent} aria-label={`Uploading ${name}`} className="w-full basis-full">
          <ProgressValue />
        </Progress>
      )}
    </Attachment>
  );
}
