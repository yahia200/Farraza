'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  contentTypeOf,
  declaredDuration,
  shouldCompressImage,
  type DeclaredFile,
  type FieldError,
} from '@repo/shared';
import { createUpload } from '@/app/actions/applications';
import { FileDropzone } from '@/components/file-upload/file-dropzone';
import { FileUploadItem } from '@/components/file-upload/file-upload-item';
import { QuestionnaireChoices, QuestionnaireInput } from '@/components/ui/questionnaire';
import { compressImageForUpload } from '@/lib/compress-image';
import { formatFileSize } from '@/lib/format';
import { readMediaDuration } from '@/lib/media-duration';
import { putFile } from '@/lib/put-file';

type Upload =
  /** A large image being shrunk in the browser before it is sent (ticket 08). */
  | { file: File; status: 'compressing' }
  /** `reducedFrom`: the size the applicant picked, when a smaller compressed copy is what is sent. */
  | { file: File; status: 'sending'; percent: number; reducedFrom?: number }
  | { file: File; status: 'failed'; message: string; reducedFrom?: number }
  /** The file id is held by the form (`value`), not here. */
  | { file: File; status: 'sent'; reducedFrom?: number };

/** What a file is for, as the API's create-upload request says it (`purpose`, and the question for an answer). */
export type UploadTarget = { purpose: 'cv' } | { purpose: 'answer'; fieldKey: string };

/**
 * The file picker shared by the CV step and every Attachment step: choosing or dropping a file
 * (`FileDropzone`, one file) checks it in the browser first (`check`), then asks the Server Action for a presigned URL and PUTs the bytes
 * straight to the bucket with progress. Only the file's id goes into the form, through `onChange`;
 * the file itself stays in memory and is never saved locally. The chosen file is shown as a
 * `FileUploadItem` (a shadcn Attachment).
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
  /** True while the length of a video or audio file is being read. */
  const [measuring, setMeasuring] = useState(false);
  const current = useRef<AbortController | null>(null);

  // Leaving the page (or this step being unmounted) stops a transfer in progress.
  useEffect(() => () => current.current?.abort(), []);

  // The form can clear the id (the server refused it): then there is nothing uploaded any more.
  const shown = upload?.status === 'sent' && value === null ? null : upload;
  const sending = shown?.status === 'sending' || shown?.status === 'compressing' || measuring;

  function stop() {
    current.current?.abort();
    current.current = null;
  }

  /**
   * `reduce` is false for "Try again": the file is already the one to send, so it isn't shrunk
   * again; `reducedFrom` carries the size originally picked, for the note under the name.
   */
  async function send(picked: File, { reduce = true, reducedFrom }: { reduce?: boolean; reducedFrom?: number } = {}) {
    stop();
    setMeasuring(false);
    setRejection(undefined);
    onChange(null);

    const controller = new AbortController();
    current.current = controller;

    let file = picked;
    let contentType = contentTypeOf(file);
    let problem = check({ contentType, sizeBytes: file.size });

    // Ticket 08: a large image is shrunk before anything else, so a 12 MB phone photo can still
    // pass a 10 MB limit. Only a wrong type turns it away outright; a size problem is re-checked
    // on the smaller file. The declared size and type below are those of the file actually sent.
    if (reduce && problem?.path !== 'contentType' && shouldCompressImage({ contentType, sizeBytes: file.size })) {
      setUpload({ file, status: 'compressing' });
      onBusyChange(true);
      try {
        file = await compressImageForUpload({ file, contentType, signal: controller.signal });
      } catch {
        // Only an abort throws: the applicant removed or replaced the file meanwhile.
        return;
      }
      if (controller.signal.aborted) return;
      if (file !== picked) reducedFrom = picked.size;
      contentType = contentTypeOf(file);
      problem = check({ contentType, sizeBytes: file.size });
    }

    // Videos and audio (ticket 09): type and size passed and only the length is missing, so read
    // it from the file actually being sent (`lib/media-duration.ts`) and check again with it.
    let durationSeconds: number | undefined;
    if (problem?.path === 'durationSeconds') {
      setMeasuring(true);
      onBusyChange(true);
      const seconds = await readMediaDuration(
        file,
        contentType.startsWith('audio/') ? 'audio' : 'video',
        controller.signal,
      );
      if (controller.signal.aborted) return; // replaced or removed meanwhile
      setMeasuring(false);
      // Unreadable (an unsupported codec, a broken file) is refused: the server cannot re-measure
      // the length, so without it the question's limit could not be applied at all.
      durationSeconds = (seconds !== null ? declaredDuration(seconds) : null) ?? undefined;
      problem = check({ contentType, sizeBytes: file.size, durationSeconds });
    }

    if (problem) {
      setUpload(null);
      onBusyChange(false);
      setRejection(problem.message);
      return;
    }

    setUpload({ file, status: 'sending', percent: 0, reducedFrom });
    onBusyChange(true);

    try {
      const created = await createUpload(companySlug, jobSlug, {
        ...target,
        originalName: file.name,
        contentType,
        sizeBytes: file.size,
        ...(durationSeconds !== undefined && { durationSeconds }),
      });
      if (controller.signal.aborted) return;
      if (!created.upload) {
        throw new Error(created.formError ?? 'Something went wrong. Please try again.');
      }
      await putFile({
        url: created.upload.url,
        file,
        contentType: created.upload.contentType,
        onProgress: (percent) => setUpload({ file, status: 'sending', percent, reducedFrom }),
        signal: controller.signal,
      });
      setUpload({ file, status: 'sent', reducedFrom });
      onChange(created.upload.fileId);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setUpload({
        file,
        status: 'failed',
        message: caught instanceof Error ? caught.message : 'The upload failed.',
        reducedFrom,
      });
    }
    // Reached when this upload wasn't replaced or removed meanwhile (those return above).
    onBusyChange(false);
  }

  function remove() {
    stop();
    setMeasuring(false);
    setUpload(null);
    setRejection(undefined);
    onChange(null);
    onBusyChange(false);
  }

  const state =
    shown?.status === 'compressing' ? 'processing' : shown?.status === 'failed' ? 'error' : shown?.status === 'sent' ? 'done' : 'uploading';

  return (
    <QuestionnaireChoices className="flex flex-col gap-3">
      {/* The zone's file input is what gets keyboard focus (Enter or Space opens the chooser);
          dropping a file is an addition for pointers. Several files at once are refused. */}
      <FileDropzone
        accept={accept}
        disabled={sending}
        aria-describedby={`${inputId}-status`}
        title={shown ? 'Drop a different file here, or browse' : undefined}
        onFiles={([file]) => void send(file)}
        onReject={(message) => {
          setUpload(null);
          setRejection(message);
        }}
      />

      <div id={`${inputId}-status`} aria-live="polite" className="flex flex-col gap-2">
        {measuring && <p className="text-sm text-muted-foreground">Checking the length of your file…</p>}
        {rejection && <p className="text-sm text-destructive">{rejection}</p>}

        {shown && (
          <FileUploadItem
            name={shown.file.name}
            sizeBytes={shown.file.size}
            contentType={contentTypeOf(shown.file)}
            state={state}
            percent={shown.status === 'sending' ? shown.percent : undefined}
            description={
              shown.status === 'compressing'
                ? 'Reducing the image size…'
                : shown.status === 'failed'
                  ? shown.message
                  : shown.status === 'sending'
                    ? undefined // the item's own "Uploading · 42%"
                    : [
                        formatFileSize(shown.file.size),
                        shown.reducedFrom !== undefined && `reduced from ${formatFileSize(shown.reducedFrom)}`,
                        shown.status === 'sent' && 'uploaded',
                      ]
                        .filter(Boolean)
                        .join(' · ')
            }
            onRemove={remove}
            onRetry={
              shown.status === 'failed'
                ? () => void send(shown.file, { reduce: false, reducedFrom: shown.reducedFrom })
                : undefined
            }
          />
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
