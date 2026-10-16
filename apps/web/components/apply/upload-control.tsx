'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { FileTextIcon, RotateCcwIcon, UploadIcon, XIcon } from 'lucide-react';
import { contentTypeOf, type DeclaredFile, type FieldError } from '@repo/shared';
import { createUpload } from '@/app/actions/applications';
import { Button, buttonVariants } from '@/components/ui/button';
import { Progress, ProgressValue } from '@/components/ui/progress';
import { QuestionnaireChoices, QuestionnaireInput } from '@/components/ui/questionnaire';
import { formatFileSize } from '@/lib/format';
import { putFile } from '@/lib/put-file';
import { cn } from '@/lib/utils';

type Upload =
  | { file: File; status: 'sending'; percent: number }
  | { file: File; status: 'failed'; message: string }
  /** The file id is held by the form (`value`), not here. */
  | { file: File; status: 'sent' };

/** What a file is for, as the API's create-upload request says it (`purpose`, and the question for an answer). */
export type UploadTarget = { purpose: 'cv' } | { purpose: 'answer'; fieldKey: string };

/**
 * The file picker shared by the CV step and every Attachment step: choosing a file checks it in
 * the browser first (`check`), then asks the Server Action for a presigned URL and PUTs the bytes
 * straight to the bucket with progress. Only the file's id goes into the form, through `onChange`;
 * the file itself stays in memory and is never saved locally.
 *
 * The questionnaire's Input has no file type, so this is a custom control inside a regular
 * `QuestionnaireItem` (shadcn Questionnaire: https://ui.shadcn.com/docs/react/questionnaire). The
 * questionnaire counts a step as answered only when one of its own controls has a value, so a
 * read-only text input mirrors the file id. That is what lets "Next" and "Send" work on the step.
 */
export function UploadControl({
  companySlug,
  jobSlug,
  target,
  accept,
  check,
  value,
  onChange,
  onBusyChange,
}: {
  companySlug: string;
  jobSlug: string;
  target: UploadTarget;
  /** The file input's `accept` attribute; it only steers the chooser. */
  accept: string;
  /** The first problem with the picked file, or null. Runs before any request; its message is shown as is. */
  check: (file: DeclaredFile) => FieldError | null;
  /** The uploaded file's id, or null. */
  value: string | null;
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

    const contentType = contentTypeOf(file);
    const problem = check({ contentType, sizeBytes: file.size });
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
        ...target,
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

  return (
    <QuestionnaireChoices className="flex flex-col gap-3">
      {/* A real file input, visually hidden and placed first, so it is the control that gets
          keyboard focus (Enter or Space opens the chooser) and the label below shows a ring for it. */}
      <input
        id={inputId}
        type="file"
        accept={accept}
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
  );
}
