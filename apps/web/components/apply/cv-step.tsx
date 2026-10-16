'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { FileTextIcon, RotateCcwIcon, UploadIcon, XIcon } from 'lucide-react';
import { CV_ACCEPT_HINT, CV_CONTENT_TYPES, checkCvFile, cvContentTypeOf } from '@repo/shared';
import { createUpload } from '@/app/actions/applications';
import { Button, buttonVariants } from '@/components/ui/button';
import { Progress, ProgressValue } from '@/components/ui/progress';
import {
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireTitle,
} from '@/components/ui/questionnaire';
import { formatFileSize } from '@/lib/format';
import { putFile } from '@/lib/put-file';
import { cn } from '@/lib/utils';

/** What the file chooser offers: extensions as well as types, as some systems report no type for .docx. */
const ACCEPT = ['.pdf', '.docx', ...CV_CONTENT_TYPES].join(',');

type Upload =
  | { file: File; status: 'sending'; percent: number }
  | { file: File; status: 'failed'; message: string }
  /** The file id is held by the form (`value`), not here. */
  | { file: File; status: 'sent' };

/**
 * The CV, the first step of the apply form when the job asks for one (ADR-0002). The
 * questionnaire's Input has no file type, so this is a custom control inside a regular
 * `QuestionnaireItem` (shadcn Questionnaire: https://ui.shadcn.com/docs/react/questionnaire).
 *
 * Choosing a file checks it in the browser first, then asks the Server Action for a presigned
 * URL and PUTs the bytes straight to the bucket with progress. Only the file's id goes into
 * the form, through `onChange`; the file itself stays in memory and is never saved locally.
 *
 * The questionnaire counts a step as answered only when one of its own controls has a value, so a
 * read-only text input mirrors the file id. That is what lets "Next" and "Send" work on this step.
 */
export function CvStep({
  companySlug,
  jobSlug,
  required,
  value,
  error,
  onChange,
  onBusyChange,
}: {
  companySlug: string;
  jobSlug: string;
  required: boolean;
  /** The uploaded file's id, or null. */
  value: string | null;
  /** The form's message for this step, if any. */
  error?: string;
  onChange: (fileId: string | null) => void;
  /** True while a file is being sent, so the form can hold back Next, Skip and Send. */
  onBusyChange: (busy: boolean) => void;
}) {
  const inputId = useId();
  const [upload, setUpload] = useState<Upload | null>(null);
  /** Why a chosen file was turned away before any request. */
  const [rejection, setRejection] = useState<string>();
  const current = useRef<AbortController | null>(null);

  // Leaving the page (or this step being unmounted) stops a transfer in progress.
  useEffect(() => () => current.current?.abort(), []);

  // The form can clear the id (the server refused it): then there is nothing uploaded any more.
  const shown = upload?.status === 'sent' && value === null ? null : upload;
  const sending = shown?.status === 'sending';

  function stop() {
    current.current?.abort();
    current.current = null;
  }

  async function send(file: File) {
    stop();
    setRejection(undefined);
    onChange(null);

    const contentType = cvContentTypeOf(file);
    const problem = checkCvFile({ contentType, sizeBytes: file.size });
    if (problem) {
      setUpload(null);
      onBusyChange(false);
      setRejection(problem.message);
      return;
    }

    const controller = new AbortController();
    current.current = controller;
    setUpload({ file, status: 'sending', percent: 0 });
    onBusyChange(true);

    try {
      const created = await createUpload(companySlug, jobSlug, {
        purpose: 'cv',
        originalName: file.name,
        contentType,
        sizeBytes: file.size,
      });
      if (controller.signal.aborted) return;
      if (!created.upload) {
        throw new Error(created.formError ?? 'Something went wrong. Please try again.');
      }
      await putFile({
        url: created.upload.url,
        file,
        contentType: created.upload.contentType,
        onProgress: (percent) => setUpload({ file, status: 'sending', percent }),
        signal: controller.signal,
      });
      setUpload({ file, status: 'sent' });
      onChange(created.upload.fileId);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setUpload({
        file,
        status: 'failed',
        message: caught instanceof Error ? caught.message : 'The upload failed.',
      });
    }
    // Reached when this upload wasn't replaced or removed meanwhile (those return above).
    onBusyChange(false);
  }

  function remove() {
    stop();
    setUpload(null);
    setRejection(undefined);
    onChange(null);
    onBusyChange(false);
  }

  const label = required ? 'Upload your CV' : 'Upload your CV (optional)';

  return (
    <QuestionnaireItem name="cvFileId" required={required} invalid={Boolean(error)}>
      <QuestionnaireTitle>{label}</QuestionnaireTitle>
      <QuestionnaireDescription>{CV_ACCEPT_HINT}.</QuestionnaireDescription>

      <QuestionnaireChoices className="flex flex-col gap-3">
        {/* A real file input, visually hidden and placed first, so it is the control that gets
            keyboard focus (Enter or Space opens the chooser) and the label below shows a ring for it. */}
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="peer sr-only"
          disabled={sending}
          aria-describedby={`${inputId}-status`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Clearing the value lets the same file be chosen again after removing it.
            event.target.value = '';
            if (file) void send(file);
          }}
        />
        <label
          htmlFor={inputId}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'lg' }),
            'w-fit cursor-pointer peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/30',
            sending && 'pointer-events-none opacity-50',
          )}
        >
          <UploadIcon data-icon="inline-start" />
          {shown ? 'Choose a different file' : 'Choose a file'}
        </label>

        <div id={`${inputId}-status`} aria-live="polite" className="flex flex-col gap-2">
          {rejection && <p className="text-sm text-destructive">{rejection}</p>}

          {shown && (
            <div className="flex flex-col gap-2 rounded-2xl border p-3">
              <div className="flex items-center gap-2 text-sm">
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-medium">{shown.file.name}</span>
                <span className="shrink-0 text-muted-foreground">{formatFileSize(shown.file.size)}</span>
                {shown.status === 'failed' && (
                  <Button type="button" variant="outline" size="sm" onClick={() => void send(shown.file)}>
                    <RotateCcwIcon data-icon="inline-start" />
                    Try again
                  </Button>
                )}
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${shown.file.name}`} onClick={remove}>
                  <XIcon />
                </Button>
              </div>

              {shown.status === 'sending' && (
                <Progress value={shown.percent} aria-label="Upload progress">
                  <ProgressValue />
                </Progress>
              )}
              {shown.status === 'sent' && <p className="text-sm text-muted-foreground">Uploaded.</p>}
              {shown.status === 'failed' && <p className="text-sm text-destructive">{shown.message}</p>}
            </div>
          )}
        </div>

        <QuestionnaireInput
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          value={value ?? ''}
          onChange={() => {}}
        />
      </QuestionnaireChoices>

      <QuestionnaireError>
        {error ??
          (sending
            ? 'Wait for your CV to finish uploading.'
            : required
              ? 'Upload your CV to continue.'
              : 'Upload your CV, or skip this step.')}
      </QuestionnaireError>
    </QuestionnaireItem>
  );
}
